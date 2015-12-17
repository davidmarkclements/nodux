#!/usr/bin/env node

var onExit = require('signal-exit')
var adm = require('./adm')
var path = require('path')
var hostfs = require('./hostfs')
var escapeRx = require('escape-regexp')
var minimist = require('minimist')
var isSudo = require('is-sudo')
var flags = require('./flags')
var fs = require('fs')
var spawn = require('child_process').spawn
var xhyve = path.join(__dirname, 'xhyve')
var xhyveStat = fs.statSync(xhyve)

var envFile = path.join(__dirname, 'env', process.pid + '') + '.json'

var noduxEnvMap = {
  //__NODUX_STDIN_EVAL__ 
  __NODUX_EVAL__: ['e', 'eval', 'p', 'print'],
  __NODUX_PRINT_EVAL_RESULT__: ['p', 'print'],
  __NODUX_SYNTAX_CHECK_ONLY__: ['c', 'check'],
  __NODUX_REPL__: ['i']
}

var excludeNativeFlags = ['-e', '--eval', '-p', '--print', '-c', '--check', '-i']


if (xhyveStat.mode !== 36333 || xhyveStat.uid !== 0) {
  console.log('The first time nodux is run we need to set permissions ')
  console.log('on the vm binary (xhyve) so it can access network devices.')
  console.log('This requires sudo access.')
  console.log('https://github.com/mist64/xhyve/issues/60#issuecomment-140312143')
  console.log()
  return spawn('sudo', ['-k']).on('close', function () {
    var chown = spawn('sudo', ['chown', 'root', xhyve], {
      stdio: 'inherit'
    })

    chown.on('close', function () {
      isSudo(function(sudo) {
        if (!sudo) process.exit(1)
        spawn('sudo', ['chmod', '+s', xhyve]).on('close', exec)  
      })
    })

  })
}

exec()

function exec() {

  adm('boot', function start(err, info) {
    if (err && err.code === 418) {
      return adm('ip', start)
    }
    if (err) { throw err }

    var _ = ' '
    var sudo = 'sudo'
    var node = 'node'
    var nodux = '/usr/local/bin/nodux.js'
    var cwd = process.cwd()
    var env = JSON.stringify(process.env)
    var file = minimist(process.argv.slice(2))._[0] || ''
    var nativeFlags


    if (file) {
      nativeFlags = process.argv.slice(2).slice(0, process.argv.indexOf(file) - 2)
    }

    if (!file) {
      var args = minimist(process.argv.slice(2))
      nativeFlags = Object.keys(args)


      process.argv.slice(2).forEach(function (f) {
        if (!file && fs.existsSync(path.resolve(cwd, f))) {
          file = f
        }
      }) 

      nativeFlags = nativeFlags.reduce(function(a, f) {
        if (f === '_') return a
        a.push(f.length === 1 ? '-' + f : '--' + f)
        if (args[f] !== true) {
          a.push(args[f])  
        }
        
        return a
      }, []) 
    }

    var captureFlags = minimist(nativeFlags, {  
      alias: noduxEnvMap
    })

    //TODO: STDIN eval input
    // if (!file && !require('tty').isatty(0)) {
    //   process.stdin.setEncoding('utf8')
    //   var code = ''
    //   process.stdin.on('data', function (chunk) {    
    //     code += chunk
    //   })
    //   process.stdin.on('end', function() {
    //     captureFlags.__NODUX_EVAL__ = code
    //     captureFlags.__NODUX_STDIN_EVAL__ = true
    //     run()
    //   })
    //   return 
    // }

    run()

    function run () {
      var appInput = file ? process.argv.slice(process.argv.indexOf(file) + 1).join(' ') : ''

      nativeFlags = nativeFlags
        .filter(function (f, ix) {
          var prev = nativeFlags[ix-1]
          if (prev && prev[0] === '-' && f[0] !== '-') {
            return !~excludeNativeFlags.indexOf(prev)
          }
          return true
        })
        .filter(function (f, ix) { 
          return !~excludeNativeFlags.indexOf(f)
        })
        .join(' ')


      var envVars = Object.keys(captureFlags).reduce(function (o, f) {
        if (/__NODUX_(.+)__/.test(f)) {
          o[f] = captureFlags[f]
        }
        return o
      }, {
        NODUX_HOST_CWD: cwd,
        NODUX_HOST_ENV: env
      })

      if (envVars.__NODUX_PRINT_EVAL_RESULT__) {
        envVars.__NODUX_EVAL__ = envVars.__NODUX_PRINT_EVAL_RESULT__
        envVars.__NODUX_PRINT_EVAL_RESULT__ = true
      }

      fs.writeFileSync(envFile, JSON.stringify(envVars))
      var pid = 'PID=' + process.pid
      var cmd = sudo + _ + pid + _ + node + _ + nativeFlags + _ + nodux + _ + file + _ + appInput

      function start() {
        adm(['run', cmd], function (err, code) {
          process.exit(code)
        })
      }

      hostfs({host: info.ip, envMapPath: __dirname}, start, start)
    }

  })

}

onExit(function () { 
  if (fs.existsSync(envFile)) { fs.unlinkSync(envFile) }
})

