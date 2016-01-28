# nodux

Run Node on Linux on OS X, seamlessly.

![nodux](./demo.gif)

* No additional OS/external dependencies
* Small size, low resource virtualizer - bundled.
* Use exactly like node

### Requires

OS X Yosemite or higher (for xhyve hypervisor).

### Install

```
npm install nodux -g
```

### Usage

Nodux has the exact same functionality as node:

```
nodux [node|v8 flags] <file> [args...]
```

This will run node in a small VM running Tiny Core Linux.

All node flags are supported (apart from `--r` - coming soon).

Just like node, if no file is supplied, `nodux` will open a REPL.


### Runtime Environment

* If the VM is not running, it will be booted when `nodux` is called
* Subsequent calls to `nodux` will run in the same VM
  * `nodux-adm halt` or `nodux-adm kill` can be used to stop the VM
* The host file system is emulated inside the VM, and then chrooted into
  * this means that all filesystem manipulation affects the host file system
* Environment variables just work: `process.env` refers to host machine environment variables
* Currently nodux runs Node v5.2.0 - 

### First Run

The `xhyve` binary (included) needs root permissions to 
access the OS X network layer. On the first run `nodux`
will ask for a password, these are the steps it performs

* sudo -k (clears sudo cache to ensure we get explicit permission)
* sudo chown root xhyve (make root own xhyve)
* sudo chmod +s xhyve (adds the `setuid` bit, which runs xhyve as root without needing sudo)

### Admin

```
$ nodux-adm
Usage:     nodux-adm <command> [args...]

Commands:
Commands:
  boot       boots the vm
  status     checks if vm is running or not
  npm [args] run npm commands inside the vm, on host cwd (useful for npm rebuild)
  ssh        sshes into vm and attaches the session to your terminal
  ip         get the ip of the vm
  run        runs a single command over ssh
  halt [-f]  runs sudo halt in vm, initiating a graceful shutdown. The -f flag
             immediately ungracefully kills the vm process with SIGKILL
  pid        get the pid of the vm process
  kill       run the kill command against a process in the vm
  ps         run ps command within vm
  vms        print all vm processes running on this machine
  bin        output contents of node binary within vm (useful for core dump analysis)
```


### Native Modules and Spawning

Node is running in a Linux environment from an OS X file system.

This means any installed modules with native bindings will fail
inside the VM. Any native bindings need to be recompiled within 
the VM - this is on the road map.

Additionally, the node process that runs in the VM is chrooted
to the root of the host system. This means that exec/spawning 
any common Linux/OS X binary in hosts PATH will fail. Node will attempt to execute the OS X binary on Linux. This is also on
the roadmap to solve. 

### Jailing

*tl;dr* - if you want a core file, use the `--kludge-jail` flag.

Inside the VM, Nodux mounts the host file system, and then chroots into it just before
executing code - this makes for an apparently seamless environment: we execute on a linux
machine, but seemingly on the OS X file system. 

However, generating a core file in this context fails. When process abort occurs the underlying C code attempts apply file meta data to the core file that's incompatible with the mounted host file system, so the core file is written but empty. The solution
to this is to write the core file to a path on the VM filesystem, however since we're in 
a chroot that can't be done. 

To work around this we supply the `--kludge-jail` flag

```sh
nodux --kludge-jail thing-that-creates-core-dump.js
```

Rather than being a true chroot, this simulates a chroot at the JavaScript level by
taking all sorts of uncouth actions. Essentially then, this allows C/C++ code to still
access the virtual machine file system - thus allowing a core file to be generated.


### Roadmap

* Multiple node version management
* Immutable/isolated container mode (ala Docker)
  * one VM per process
  * isolated fs
* native module support
* process spawning support
* Configurable chroot (e.g. chroot to __dirname or pwd instead of /)


## Thanks

* [hyperos](https://github.com/maxogden/linux) for trailblazing the concept of an npm installable virtualizer and really reducing the learning curve by means of example.
* [nearForm](http://nearform.com) for sponsoring development
* [xhyve](https://github.com/mist64/xhyve) for building an awesome lightweight virtualizer
