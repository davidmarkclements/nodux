var net = require('net')
var fs = require('fs')
var rfuse = require('hyperfuse')
var proc = require('child_process')
var join = require('path').join
var resolve = require('path').resolve
var debug = require('debug')
var log = debug('nodux:hostfs')

if (!module.parent) {
  return hostfs(require('minimist')(process.argv.slice(2)))
}

module.exports = hostfs

function hostfs(opts, cb, dc) { 
  opts = opts || {}
  opts.host = opts.host || process.argv.slice(2)[0]
  opts.envMapPath = opts.envMapPath || process.argv.slice(2)[1] || ''
  var from = '/'
  var vm = '/vm'
  var stream = rfuse({
    statfs: function (path, cb) {
      log('statfs', path)
      cb(null, {
        bsize: 1000000,
        frsize: 1000000,
        blocks: 1000000,
        bfree: 1000000,
        bavail: 1000000,
        files: 1000000,
        ffree: 1000000,
        favail: 1000000,
        fsid: 1000000,
        flag: 1000000,
        namemax: 1000000
      })
    },
    ftruncate: function (path, fd, size, cb) {
      log('ftruncate', path, fd, size)
      if (path === vm) return cb({})
      fs.ftruncate(fd, size, cb)
    },
    fsync: function (path, fd, datasync, cb) {
      log('fsync', path, fd, datasync)
      if (path === vm) return cb({})
      fs.fsync(fd, cb)
    },
    unlink: function (path, cb) {
      log('unlink', path)
      if (path === vm) return cb({})
      fs.unlink(join(from, path), cb)
    },
    create: function (path, mode, cb) {
      log('create', path, mode)
      if (path === vm) return cb({})
      fs.open(join(from, path), 'w', cb)
    },
    open: function (path, mode, cb) {
      log('open', path, mode)
      if (path === vm) return cb({})
      if (path.substr(0, 4) === '/env') path = opts.envMapPath + path
      fs.open(join(from, path), mode, cb)
    },
    truncate: function (path, size, cb) {
      log('truncate', path, size)
      if (path === vm) return cb({})
      fs.truncate(join(from, path), size, cb)
    },
    read: function (path, fd, buffer, len, pos, cb) {
      log('read', path, fd, len, pos)
      if (path === vm) return cb({})
      if (path.substr(0, 4) === '/env') path = opts.envMapPath + path
      fs.read(fd, buffer, 0, len, pos, cb)
    },
    write: function (path, fd, buffer, len, pos, cb) {
      log('write', path, fd, len, pos)
      if (path === vm) return cb({})
      fs.write(fd, buffer, 0, len, pos, cb)
    },
    readdir: function (path, cb) {
      log('readdir', path)
      if (path === vm) return cb({})
      if (path.substr(0, 4) === '/env') path = opts.envMapPath + path
      fs.readdir(join(from, path), cb)
    },
    fgetattr: function (path, fd, cb) {
      log('fgetattr', path, fd)
      if (path === vm) return cb({})
      fs.fstat(fd, cb)
    },
    getattr: function (path, cb) {
      log('getattr', path)
      if (path === vm) return cb({})
      if (path.substr(0, 4) === '/env') path = opts.envMapPath + path
      fs.lstat(join(from, path), cb)
    },
    chmod: function (path, mode, cb) {
      log('chmod', path, mode)
      if (path === vm) return cb({})
      fs.chmod(join(from, path), mode, cb)
    },
    chown: function (path, uid, gid, cb) {
      log('chown', path, uid, gid)
      if (path === vm) return cb({})
      fs.chown(join(from, path), uid, gid, cb)
    },
    release: function (path, fd, cb) {
      log('release', path, fd)
      if (path === vm) return cb({})
      fs.close(fd, cb)
    },
    mkdir: function (path, mode, cb) {
      log('mkdir', path, mode)
      if (path === vm) return cb({})
      fs.mkdir(join(from, path), mode, cb)
    },
    rmdir: function (path, cb) {
      log('rmdir', path)
      if (path === vm) return cb({})
      fs.rmdir(join(from, path), cb)
    },
    utimens: function (path, atime, mtime, cb) {
      log('utimens', path, atime, mtime)
      if (path === vm) return cb({})
      fs.utimes(join(from, path), atime, mtime, cb)
    },
    rename: function (path, dst, cb) {
      log('rename', path, dst)
      if (path === vm) return cb({})
      fs.rename(join(from, path), join(from, dst), cb)
    },
    symlink: function (src, dst, cb) {
      log('symlink', src, dst)
      if (path === vm) return cb({})
      fs.symlink(src, join(from, dst), cb)
    },
    readlink: function (path, cb) {
      log('readlink', path)
      if (path === vm) return cb({})
      fs.readlink(join(from, path), function (err, link) {
        if (err) return cb(err)
        if (link === from || link.indexOf(from + '/') === 0) link = link.replace(from, stream.path)
        cb(0, link)
      })
    },
    link: function (src, dst, cb) {
      log('link', src, dst)
      if (path === vm) return cb({})
      fs.link(join(from, src), join(from, dst), cb)
    },
    setxattr: function (path, name, val, len, pos, flags, cb) {
      log('setxattr', path, name, val, pos, flags)
      if (path === vm) return cb({})
      cb()
    }
  })

  stream.on('mount', function (mnt) {
    log('fuse mounted on', mnt)
    if (cb) cb()
  })

  var sock = net.connect({port: 10009, host: opts.host})

  sock.on('close', function () { 
    log('socket closed') 
    if (dc) dc()
  })

  sock.pipe(stream).pipe(sock)

}