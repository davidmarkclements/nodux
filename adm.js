#!/usr/bin/env node

var child = require('child_process')
var fs = require('fs')
var os = require('os')
var path = require('path')
var daemon = require('daemonspawn')
var catNames = require('cat-names')
var keypair = require('keypair')
var forge = require('node-forge')
var mkdirp = require('mkdirp')
var psjson = require('psjson')
var minimist = require('minimist')
var connect = require('ssh-connect-prompt')
var keypress = require('keypress')
var argv = minimist(process.argv.slice(2), {boolean: true})

if (!module.parent) {
  return adm(argv._, argv)
}

module.exports = adm

function adm(cmds, opts, done) {
  cmds = !Array.isArray(cmds) ? [cmds] : cmds
  if (opts instanceof Function) {
    done = opts
    opts = null
  }
  opts = opts || {}

  // needs yosemite 10.10.3 or above for xhyve
  if (os.platform() !== 'darwin' || os.release() < '14.3.0') return console.error('Error: Mac OS Yosemite 10.10.3 or above required')

  var dir = opts.path || opts.p || path.join(__dirname, 'linux')
  if (!opts.stderr) opts.stderr = path.join(dir, 'stderr.log')
  if (!opts.stdout) opts.stdout = path.join(dir, 'stdout.log')
  var linuxPid = opts.pid || path.join(dir, 'linux.pid')
  var linuxHostname = path.join(dir, 'hostname')
  var keyPath = path.join(dir, 'id_rsa')
  var xhyve = __dirname + '/xhyve'

  var cmd = cmds[0]
  if (typeof cmd === 'undefined') {
    return console.log(
      'Usage:     nodux adm <command> [args...]\n' +
      '\n' +
      'Commands:\n' +
      '  init     creates a new ./linux folder in this directory to hold config\n' +
      '  boot     boots up linux from config in ./linux\n' +
      '  status   checks if linux is running or not\n' +
      '  ssh      sshes into linux and attaches the session to your terminal\n' +
      '  ip       get the ip of the linux vm\n' +
      '  run      runs a single command over ssh\n' +
      '  halt     runs sudo halt in linux, initiating a graceful shutdown\n' +
      '  kill     immediately ungracefully kills the linux process with SIGKILL\n' +
      '  pid      get the pid of the linux process\n' +
      '  ps       print all linux processes running on this machine' +
      ''
    )
  }

  if (cmd === 'init') {
    if (fs.existsSync(dir)) return console.log('Error: linux config folder already exists, skipping init')
    mkdirp.sync(dir)
    if (!fs.existsSync(keyPath)) saveNewKeypairSync()
    console.log('Created new config folder at', dir)
    return
  }

  if (cmd === 'boot') {


    // ensure linux folder exists
    if (!fs.existsSync(dir)) return console.log('Error: no linux config folder found, run linux init first')

    // ensure key permissions are correct
    if (fs.accessSync) fs.accessSync(keyPath)

    getPid()

    return
  }

  if (cmd === 'pid') {
    readPid(function (err, pid) {
      if (err) throw err
      console.log(pid)
    })
    return
  }

  if (cmd === 'status') {
    linuxStatus(function (err, running, pid) {
      if (err) throw err
      if (running) console.log('Linux is running', {pid: pid})
      else console.log('Linux is not running')
    })
    return
  }

  if (cmd === 'kill') {
    linuxStatus(function (err, running, pid) {
      if (err) throw err
      if (!running) return console.log('Linux was not running')
      daemon.kill(pid, function (err) {
        if (err) throw err
        console.log('Linux has been killed')
      })
    })
    return
  }

  if (cmd === 'ip') {
    var hostname = fs.readFileSync(linuxHostname).toString()
    parseIp(hostname, function (err, ip) {
      if (err) {
        if (done) return done(err)
        throw err
      }
      if (done) return done(null, {ip: ip})
      console.log(ip)
    })
    return
  }

  if (cmd === 'ssh') {
    return ssh()
  }

  if (cmd === 'run') {
    // run is special, we want to forward raw args to ssh
    var runIdx
    var args = module.parent ? cmds : process.argv;

    for (var i = 0; i < args.length; i++) {
      if (args[i] === 'run') {
        runIdx = i
        break
      }
    }
    // reparse argv so we don't include any run args
    argv = minimist(args.slice(0, runIdx + 1), {boolean: true})

    return ssh(args.slice(runIdx + 1))
  }

  if (cmd === 'halt') {
    return ssh(['sudo', 'halt'])
    // todo wait till xhyve actually exits
  }

  if (cmd === 'ps') {
    return ps()
  }

  console.log(cmd, 'is not a valid command')

  function getPid () {
    fs.exists(linuxPid, function (exists) {
      if (!exists) return boot()
      readPid(function (err, pid) {
        if (err) throw err
        if (!pid) return boot()
        getStatus(pid)
      })
    })
  }

  function getStatus (pid) {
    daemon.status(pid, function (err, running) {
      if (err) {
        if (done) { return done(err) }
        throw err
      } 
      var e = 'Linux is already running'
      if (running) {
        if (done) {
          e = Error(e)
          e.code = 418
          return done(e)
        }
        return console.error(e)
      }
      boot()
    })
  }

  function boot () {
    var hostname = opts.hostname || [catNames.random(), catNames.random(), catNames.random(), catNames.random()].join('-').toLowerCase().replace(/\s/g, '-')
    var bootArgs = createBootArgs(hostname, keyPath)
    var launchPath = 'LAUNCHPATH=' + process.cwd()
    var cmd = xhyve + ' ' + bootArgs.join(' ') + ' ' + launchPath

    if (opts.debug) return console.log(cmd)

    // convert filenames to file descriptors
    opts.stdio = ['ignore', fs.openSync(opts.stdout, 'a'), fs.openSync(opts.stderr, 'a')]
    opts.detached = true
    var linux = daemon.spawn(cmd, opts)
    var pid = linux.pid
    fs.writeFileSync(linuxPid, pid.toString())
    fs.writeFileSync(linuxHostname, hostname)
    pollIp(hostname, pid)
  }

  function pollIp (hostname, pid) {
    var timeout = Date.now() + (opts.timeout || 1000 * 15)

    check()

    function check () {
      if (Date.now() > timeout) {
        console.error('Error: Timed out waiting for linux to boot')
        kill()
        return
      }

      parseIp(hostname, function (err, ip) {
        if (err) {
          console.error(err)
          kill()
          return
        }
        if (!ip) return setTimeout(check, 1000)
        if (done) return done(null, {ip: ip, hostname: hostname, pid: pid})
        console.log('Linux has booted', {ip: ip, hostname: hostname, pid: pid})
      })
    }

    function kill () {
      daemon.kill(pid, function (err) {
        if (err) throw err
        process.exit(1)
      })
    }
  }

  function saveNewKeypairSync () {
    var pair = keypair()
    var publicKey = forge.pki.publicKeyFromPem(pair.public)
    var ssh = forge.ssh.publicKeyToOpenSSH(publicKey, 'root@localhost') // todo would whoami + hostname be better?

    fs.writeFileSync(keyPath, pair.private, {mode: 384}) // 0600
    fs.writeFileSync(keyPath + '.pub', ssh)
  }

  function ssh (commands) {
    var hostname = fs.readFileSync(linuxHostname).toString()
    parseIp(hostname, function (err, ip) {
      if (err) throw err
      if (!ip) return console.error('Error: Could not find ip for linux hostname', hostname)
      // process.stdin.setRawMode(true)
      var args = ['-i', keyPath, '-o', 'StrictHostKeyChecking=no', '-o', 'LogLevel=ERROR', 'tc@' + ip]
      if (argv.tty || argv.t) args.unshift('-t')
      if (commands) args = args.concat(commands)
      if (opts.debug) console.error('starting', 'ssh', args)

      if (!commands) {
        return child.spawn('ssh', args, {stdio: 'inherit'}).on('close', function (code, signal) {
          if (opts.debug) console.error('ssh session finished')
          if (done) done()
        })
      }


      var c = connect('tc@' + ip, {
        key: fs.readFileSync(keyPath),
        verify: false,
        interactive: false
      })

      c.on('ready', function () {
        c.shell(function (err, stream) {
          var cmd = commands.join(' ') + ' && exit $?'
          var output = ''
          stream.write('export PS1=""\n')
          stream.write('echo ready\n')
          stream.on('data', function ready(c) {
            if (c+'' !== 'ready') { return }

            stream.removeListener('data', ready)
            stream.once('data', function(c) {
              stream.write(cmd + '\n')
              stream.on('data', function ready(c) {
                output += c
                if (output.length < cmd.length) return
                if (output.replace(/\r\r\n/g, '').trim().length === cmd.trim().length) {
                  process.stdin.setRawMode(true)
                  keypress(process.stdin)
                  terminal(stream)
                  process.stdin.pipe(stream)
                  stream.pipe(process.stdout)
                  stream.removeListener('data', ready)
                }
              })
            })
          })
          stream.on('close', function() {
            if (done) { return done() }
            process.exit()
          })
        })

      })
    })
  }

  function terminal(stream) {
    process.stdin.on('keypress', function (ch, key) {
      if (!key) { 
        return 
      }
      if (key.sequence) {
        // return stream.write(key.sequence)
      }
      if (key && key.ctrl) {
        if (key.name === 'c') {
          // process.stdout.write('^C\n')
          // process.exit()
          process.stdin.write(Buffer([0x03]))
          return
        }
        if (key.name === 'd') {
          process.stdout.write('\n')
          process.exit()
        }
      }
    })
  }


  function linuxStatus (cb) {
    readPid(function (err, pid) {
      if (err) throw err
      if (!pid) return cb()
      daemon.status(pid, function (err, running) {
        cb(err, running, pid)
      })
    })
  }

  function parseIp (hostname, cb) {
    child.exec(__dirname + '/get-ip.sh ' + hostname, function (err, stdout, stderr) {
      if (err) return cb(err)
      var ip = stdout.toString().trim()
      cb(null, ip)
    })
  }

  function createBootArgs (host, key) {
    var kernel = __dirname + '/node_modules/nodux-core/os/vmlinuz64'
    var initrd = __dirname + '/node_modules/nodux-core/os/initrd.gz'
    var keyString = '\\"' + fs.readFileSync(key + '.pub').toString().trim() + '\\"'
    var cmdline = 'earlyprintk=serial host=' + host + ' sshkey=' + keyString
    var args = [
      '-A',
      '-m', '1G',
      '-s', '0:0,hostbridge',
      '-s', '31,lpc',
      '-l', 'com1,stdio',
      '-s', '2:0,virtio-net',
      '-f', '"' + ['kexec', kernel, initrd, cmdline].join(',') + '"'
    ]
    return args
  }

  function readPid (cb) {
    fs.readFile(linuxPid, function (err, buf) {
      if (err) return cb(err)
      var pid = +buf.toString()
      if (isNaN(pid)) return cb()
      cb(null, pid)
    })
  }

  function ps () {
    psjson.ps('ps -eaf', function (err, procs) {
      if (err) return console.error(err)
      procs.rows.forEach(function (proc) {
        if (proc.pid === process.pid) return // its the ps process
        if (proc.CMD.indexOf(xhyve) === -1) return // was not spawned by us
        var procDir = proc.CMD.split('LAUNCHPATH=')[1]
        if (opts.json) return console.log(JSON.stringify({pid: proc.PID, dir: procDir, uptime: proc.TIME}))
        else console.log('PID: ' + proc.PID + ', ' + 'DIR: ' + procDir + ', ' + 'UPTIME: ' + proc.TIME)
      })
    })
  }
}
