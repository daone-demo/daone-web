import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPromptWithMentionInsert,
  findActiveAtMentionQuery,
} from '../src/components/Canvas/promptMention.ts'

test('在光标后插入 @图片，并补前导空格', () => {
  const result = buildPromptWithMentionInsert({
    text: '前面文字',
    token: '@图片1',
    start: 4,
  })
  assert.equal(result.nextText, '前面文字 @图片1 ')
  assert.equal(result.nextCaret, '前面文字 @图片1 '.length)
})

test('光标前已有空格时不重复补空格', () => {
  const result = buildPromptWithMentionInsert({
    text: '前面 ',
    token: '@图片2',
    start: 3,
  })
  assert.equal(result.nextText, '前面 @图片2 ')
  assert.equal(result.nextCaret, '前面 @图片2 '.length)
})

test('插入替换选区内容', () => {
  const result = buildPromptWithMentionInsert({
    text: 'abcXYZ123',
    token: '@图片1',
    start: 3,
    end: 6,
  })
  assert.equal(result.nextText, 'abc @图片1 123')
  assert.equal(result.nextCaret, 'abc @图片1 '.length)
})

test('偏移越界时钳制到文本范围内', () => {
  const result = buildPromptWithMentionInsert({
    text: 'hi',
    token: '@图片1',
    start: 99,
    end: 120,
  })
  assert.equal(result.nextText, 'hi @图片1 ')
  assert.equal(result.nextCaret, 'hi @图片1 '.length)
})

test('空文本直接插入 token', () => {
  const result = buildPromptWithMentionInsert({
    text: '',
    token: '@图片1',
    start: 0,
  })
  assert.equal(result.nextText, '@图片1 ')
  assert.equal(result.nextCaret, '@图片1 '.length)
})

test('检测活跃 @ 查询', () => {
  assert.deepEqual(findActiveAtMentionQuery('让@', 2), { start: 1, query: '' })
  assert.deepEqual(findActiveAtMentionQuery('让@图', 3), { start: 1, query: '图' })
  assert.equal(findActiveAtMentionQuery('让@图片1', 5), null)
  assert.equal(findActiveAtMentionQuery('让 @图片1 ', 7), null)
  assert.equal(findActiveAtMentionQuery('hello', 5), null)
})

test('用 @ 查询区间替换为 mention', () => {
  const result = buildPromptWithMentionInsert({
    text: '让@',
    token: '@图片2',
    start: 1,
    end: 2,
  })
  assert.equal(result.nextText, '让 @图片2 ')
  assert.equal(result.nextCaret, '让 @图片2 '.length)
})
