#!/usr/bin/env node

var onExit = require('signal-exit')
var adm = require('./adm')
var path = require('path')
var hostfs = require('./hostfs')
var flags = require('./flags')
var args = require('minimist')(process.argv.slice(2))
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
    var file = args._[0]
    var appFlags = Object.keys(args).filter(isAppFlag).map(argStr).join(' ')
    var appArgs = args._.slice(1)
    var appInput = process.argv.slice(2).filter(function (arg, ix, args) {
      var nativeFlag = nativeFlags.some(function (f) {
        if (f === arg || arg.replace(/_/g, '-') === f) return true
        if (RegExp(arg).test(f) && RegExp(args[ix-1]).test(f)) return true
        if (RegExp(arg).test(f) && RegExp(args[ix+1]).test(f)) return true
      })
      return !nativeFlag
    }).join(' ')

    nativeFlags = nativeFlags.join(' ')
    
    adm(['run', node + _ + nativeFlags + _ + nodux + _ + cwd + _ + env + _ + file + _ + appInput])
  }
})

onExit(function () {
  adm('kill')
})

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
