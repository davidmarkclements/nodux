import path from 'path'
import {test, tearDown} from 'babel-tap'
import promisify from 'es6-promisify'
import cp from 'child_process'
import fs from 'fs'

let {exec, execSync} = cp 
exec = promisify(exec)

const nodux = path.join(__dirname, '..', 'cmd.js')
const fxt = path.join(__dirname, '..', 'fxt.js')
const fixture = str => {
  fs.writeFileSync(fxt, str)
  return fxt
}

const run = async (opts = {}) => {
  let {
    file = opts, 
    cmdArgs = '', 
    appArgs = '', 
    env = '',
    sync = false,
    spawn = false
  } = opts
  file = typeof file === 'object' ? '' : file
  let cmd = `${env} ${nodux} ${cmdArgs} ${file} ${appArgs}`

  const [result:stdout] = sync ? 
    [execSync(cmd) + ''] :
    await exec(cmd)

  return result
    .replace(/\r\n$/, '')
    .replace(/^\r\n/, '')
}

const todo = {todo: true}

tearDown(()=>fs.existsSync(fxt) && fs.unlinkSync(fxt))

test(`executes a js file`, async ({is}) => {
  const actual = await run(fixture(`console.log('ok')`))
  const expected = `ok`
  is(actual, expected)
})

test(`linux execution environment`, async ({is}) => {
  const actual = await run(fixture(`console.log(process.platform)`))
  const expected = `linux`

  is(actual, expected)
})

test(`accesses host filesystem`, async ({is}) => {
  const fxt = fixture(`console.log(__dirname)`)
  const actual = await run(fxt)
  const expected = path.dirname(fxt)
  is(actual, expected)
})

test(`shares host cwd`, async ({is}) => {
  const fxt = fixture(`console.log(process.cwd())`)
  const actual = await run(fxt)
  const expected = process.cwd()
  is(actual, expected)
})

test(`receives args`, async ({is}) => {
  const file = fixture(`
    console.log(process.argv.slice(2).join(' '))
  `)
  const appArgs = `-a b -c --dee`
  const actual = await run({file, appArgs})
  const expected = appArgs
  is(actual, expected)
})

test(`controls host STDIN stream`, async ({is}) => {
  var before = Date.now()
  await run(fixture(`
    process.stdin.resume()
    setTimeout(function () {
      process.stdin.pause()
    }, 250)
  `))
  var after = Date.now()
  const actual = after - before >= 250
  const expected = true
  is(actual, expected)
})

test(`passes v8flags`, async ({is}) => {
  const file = fixture(`console.log(v8debug)`)
  const cmdArgs = '--expose-debug-as=v8debug'
  const actual = await run({file, cmdArgs})
  const expected = '{}'
  is(actual, expected)
})

test('handles --check', async ({is}) => {
  {
    const file = fixture(`console.log('syntax sound')`)
    const cmdArgs = '--check'
    const actual = await run({file, cmdArgs})
    const expected = ''
    is(actual, expected)
  }

  {
    const file = fixture(`syntax unsound`)
    const cmdArgs = '--check'
    const actual = (await run({file, cmdArgs})).split('\r\n')[1]
    const expected = 'syntax unsound'
    is(actual, expected)
  }
})


//TODO we know this works, but for some reason
//exec'ing the cmd through node is failing
test('handles --eval', todo, async ({is}) => {
  const cmdArgs = `-e "console.log('ok')"`
  const actual = await run({cmdArgs, sync: true})
  const expected = 'ok'
  is(actual, expected)
})

//TODO we know this works, but for some reason
//exec'ing the cmd through node is failing
test('handles --print', todo, async ({is}) => {
  const cmdArgs = `-p "var a; if (a = 'o') { a+= 'k'}"`
  const actual = await run({cmdArgs, sync: true})
  const expected = 'ok'
  is(actual, expected)
})

// test('evals stdin input', todo, async ({is}) => {
//   const cmdArgs = ''
//   const actual = await run({cmdArgs})
//   const expected = ''
//   is(actual, expected)
// })

test('handles --help', async ({is}) => {
  const cmdArgs = '--help'
  const actual = 
    (await run({cmdArgs, sync: true})).split('\r\n')[0].trim()
  const expected = 
    'Usage: node [options] [ -e script | script.js ] [arguments]'
  is(actual, expected)
})

test('handles --version', async ({is}) => {
  const cmdArgs = '--version'
  const actual = 
    (await run({cmdArgs, sync: true}))
  const expected = 'v' + require('../package.json')['node-version']
  is(actual, expected)
})

test('handles --v8-options', async ({assert}) => {
  const cmdArgs = '--v8-options'
  const actual = await run({cmdArgs, sync: true})
  assert(/trace/gm.test(actual))
  assert(/harmony/gm.test(actual))
})

// test('handles --require', todo, async ({is}) => {
//   const fxt = fixture(``)
//   const cmdArgs = ''
//   const actual = await run(fxt, {cmdArgs})
//   const expected = ''
//   is(actual, expected)
// })

test('repl mode', async ({is}) => {

  const input = '.exit\n'
  const proc = cp.spawnSync(
      nodux,
      {input}
  )
  const actual = proc.stdout + ''
  const expected = '.exit\r\n'
  is(actual, expected)
})

// test('handles --interactive', todo, async ({is}) => {
//   const fxt = fixture(``)
//   const cmdArgs = ''
//   const actual = await run(fxt, {cmdArgs})
//   const expected = ''
//   is(actual, expected)
// })

test('derives env vars from host environment', async ({is}) => {
  const file = fixture(`console.log(process.env.FOO)`)
  const env = 'FOO=1'
  const actual = await run({file, env})
  const expected = '1'
  is(actual, expected)
})