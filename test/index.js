import path from 'path'
import {test, tearDown} from 'babel-tap'
import {fs, childProcess} from 'node-promise-es6'
const {exec, spawn} = childProcess
const nodux = path.join(__dirname, '..', 'cmd.js')
const fxt = path.join(__dirname, '..', 'fxt.js')
const fixture = str => {
  fs.writeFileSync(fxt, str)
  return fxt
}
const run = async (fxt, opts = {}) => {
  const {cmdArgs = '', appArgs = ''} = opts
  const {stdout, stderr} = await exec(`
    ${nodux} ${cmdArgs} ${fxt} ${appArgs}
  `)
  return stdout
    .replace(/\r\n$/, '')
    .replace(/^\r\n/, '')
}
const todo = {todo: true}

tearDown(()=>fs.unlinkSync(fxt))

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

test(`receives args`, async ({is}) => {
  const fxt = fixture(`
    console.log(process.argv)
  `)
  const appArgs = `-a b -c --dee`
  const actual = await run(fxt, {appArgs})
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
  const fxt = fixture(`console.log(v8debug)`)
  const cmdArgs = '--expose-debug-as=v8debug'
  const actual = await run(fxt, {cmdArgs})
  const expected = '{}'
  is(actual, expected)
})

test('handles --check', todo, async ({is}) => {
  const fxt = fixture(``)
  const cmdArgs = ''
  const actual = await run(fxt, {cmdArgs})
  const expected = ''
  is(actual, expected)
})

test('handles --eval', todo, async ({is}) => {
  const fxt = fixture(``)
  const cmdArgs = ''
  const actual = await run(fxt, {cmdArgs})
  const expected = ''
  is(actual, expected)
})

test('handles --print', todo, async ({is}) => {
  const fxt = fixture(``)
  const cmdArgs = ''
  const actual = await run(fxt, {cmdArgs})
  const expected = ''
  is(actual, expected)
})

test('handles --help', todo, async ({is}) => {
  const fxt = fixture(``)
  const cmdArgs = ''
  const actual = await run(fxt, {cmdArgs})
  const expected = ''
  is(actual, expected)
})

test('handles --version', todo, async ({is}) => {
  const fxt = fixture(``)
  const cmdArgs = ''
  const actual = await run(fxt, {cmdArgs})
  const expected = ''
  is(actual, expected)
})

test('handles --v8-options', todo, async ({is}) => {
  const fxt = fixture(``)
  const cmdArgs = ''
  const actual = await run(fxt, {cmdArgs})
  const expected = ''
  is(actual, expected)
})

test('handles --require', todo, async ({is}) => {
  const fxt = fixture(``)
  const cmdArgs = ''
  const actual = await run(fxt, {cmdArgs})
  const expected = ''
  is(actual, expected)
})





