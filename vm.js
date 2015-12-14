var net = require('net')
var resolve = require('path').resolve
var proc = require('child_process')
var from = resolve('mirror')

var child = proc.spawn('hyperfused', ['host', '-'])

net.createServer(function (sock) {

  child.stderr.pipe(process.stderr)

  child.stdout.pipe(sock).pipe(child.stdin)

  child.on('exit', function () {
    console.error('hyperfused exited')
    process.exit()
  })

}).listen(10009)