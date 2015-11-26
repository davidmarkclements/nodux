# nodux

Tiny linux containers for rapid, minimal overhead development on OS X.

 
[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

## IMPLEMENTATION INCOMPLETE - DO NOT USE (YET)

### About

Containers are awesome, Docker is awesome. 

But using docker for local development, particularly on OS X can be arduous, see
<https://github.com/brikis98/docker-osx-dev> for all the hoops you need to jump through
to set up a dev environment with Docker and OS X. And once you've done all that.. it's 
noticeably slow.

Running a Tiny Core Linux vm on the new OS X hypervisor (Hypervisor.framework) turns out
to be a relatively tiny install and very fast. 

Another benefit of a Linux development container on OS X is the ability to generate Linux
core files. These (unlike OS X core files) can be passed into [autopsy](http://npmjs.com/autopsy)
for advanced high and low level introspection.

### Requires

OS X Yosemite or higher (for xhyve hypervisor).

### Install

```
npm install nodux -g
```

### Usage

Use nodux in the exact same way you would use the node binary

```
nodux <file> [args...]
```

All node flags are supported.

If no file is supplied, nodux will open a repl within the container. 

There are also some nodux specific arguments

#### ssh argument

```
nodux --ssh <pid>
```

Logs into a nodux vm as per specified pid, if no pid is providing nodux
will start a vm and ssh into it. 


### Example

```
nodux myfile.js 
```

## How it works

* Boots a Tiny Core Linux image that has node preinstalled in an xhyve vm
* Uses hyperfuse within the vm to catch file system operations and routes them back out of the container into the host file system.
  * files within the folder are written to host *and* vm fs - thus allowing for file system write listeners to trigger within the vm
  * on the host system files are rsynced into the container to ensure file changes propagate
    * this is useful for a build pipeline running on the host (transpilation for instance)
* passes all arguments to the node executable inside the vm


## todo 

* keep the vm version of node in sync with the host system node version
  * perhaps just do this dynamically inside the vm

# Special Thanks

- [hyperos](https://github.com/maxogden/linux) for trailblazing the concept and really reducing the learning curve by means of example.