#!/usr/bin/env node

var onExit = require('signal-exit')
var adm = require('./adm')
var path = require('path')
var hostfs = require('./hostfs')
var flags = require('./flags')
var args = require('minimist')(process.argv.slice(2))

var fs = require('fs')
var spawn = require('child_process').spawn
var isSudo = require('is-sudo')
var xhyve = path.join(__dirname, 'xhyve')
var xhyveStat = fs.statSync(xhyve)


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

    hostfs({host: info.ip}, run, function dc() { 
      throw Error('Panic: Hostfs disconnected from vm')
    })

    function run () {
      var _ = ' '
      
      var node = 'sudo node'
      var nativeFlags = Object.keys(args).filter(isNativeFlag).map(argStr)
      var nodux = '/usr/local/bin/nodux.js'
      var cwd = '"' + process.cwd() + '"'
      var env = '\'' + JSON.stringify(process.env) + '\''
      var file = args._[0] || ''
      var appFlags = Object.keys(args).filter(isAppFlag).map(argStr).join(' ')
      var appArgs = args._.slice(1)
      var appInput = process.argv.slice(2).filter(function (arg, ix, args) {
        var nativeFlag = nativeFlags.some(function (f) {
          if (f === file) return false
          if (f === arg || arg.replace(/_/g, '-') === f) return true
          if (RegExp(arg).test(f) && RegExp(args[ix-1]).test(f)) return true
          if (RegExp(arg).test(f) && RegExp(args[ix+1]).test(f)) return true
        })
        return !nativeFlag
      }).join(' ')

      nativeFlags = nativeFlags.join(' ')

      var cmd = node + _ + nativeFlags + _ + nodux + _ + cwd + _ + env + _ + file + _ + appInput

      adm(['run', cmd], function (err, code) {
        process.exit(code)
      })
    }
  })

}

function argStr(f) {
  var dash = (f.length === 1) ? '-' : '--'
  var prefix = (args[f] === false) ? 'no-' : ''
  var suffix = (typeof args[f] === 'string') ? '=' + args[f] : ''
  return dash + prefix + f + suffix
}

function isNativeFlag(f) {
  if (f === '_') return false
  return !!~flags.indexOf(f)
}

function isAppFlag(f) {
  if (f === '_') return false
  return !~flags.indexOf(f) 
}
