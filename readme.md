# nodux

Run Node on Linux on OS X, seamlessly.

![nodux](demo.gif)

* No additional OS/external dependencies
* Small size, low resource VM - bundled.
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
  init     creates a single linux folder
  boot     boots up linux from config in ./linux
  status   checks if linux is running or not
  ssh      ssh into linux and attaches the session to your terminal
  run      runs a single command over ssh
  halt     runs sudo halt in linux, initiating a graceful shutdown
  kill     immediately ungracefully kills the linux process with SIGKILL
  pid      get the pid of the linux process
  ps       print all linux processes running on this machine
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


### Roadmap

* Multiple node version management
* Immutable/isolated container mode (ala Docker)
  * one VM per process
  * isolated fs
* native module support
* process spawning support
* Configurable chroot (e.g. chroot to __dirname or pwd instead of /)


## Thanks

* [hyperos](https://github.com/maxogden/linux) for trailblazing the concept and really reducing the learning curve by means of example.
* [nearForm](http://nearform.com) for sponsoring development
