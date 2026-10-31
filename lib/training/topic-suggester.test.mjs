// Run: node --test lib/training/topic-suggester.test.mjs  (Node 22.18+ strips the TS types)
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTopicSuggester, normalizeQuestion } from './topic-suggester.ts';

const bank = [
  { question: 'Mức học phí một tín chỉ là bao nhiêu?', topic: 'Học phí' },
  { question: 'Hạn đóng học phí học kỳ 1?', topic: 'Học phí' },
  { question: 'Điều kiện đăng ký làm đồ án tốt nghiệp?', topic: 'Đồ án' },
  { question: 'Giảng viên hướng dẫn đồ án được phân công thế nào?', topic: 'Đồ án' },
  { question: 'Cách tính điểm trung bình tích lũy?', topic: 'Học vụ' },
  { question: 'Điểm trung bình học kỳ dưới bao nhiêu thì bị cảnh báo?', topic: 'Học vụ' },
];

test('normalizeQuestion ignores case, punctuation and spacing', () => {
  assert.equal(normalizeQuestion('  Học  phí   bao nhiêu?? '), normalizeQuestion('học phí bao nhiêu'));
});

test('keyword cue wins even when the bank has no such question', () => {
  const suggest = buildTopicSuggester(bank);
  assert.equal(suggest('Chỉ tiêu tuyển sinh năm 2025 của Học viện?').topic, 'Tuyển sinh');
  assert.equal(suggest('học bổng lấy ntn').topic, 'Học phí');
});

test('similar labeled questions decide the topic', () => {
  const suggest = buildTopicSuggester(bank);
  assert.equal(suggest('Điểm trung bình tích lũy tính ra sao?').topic, 'Học vụ');
});

test('unrelated text falls back to Khác', () => {
  const suggest = buildTopicSuggester(bank);
  assert.equal(suggest('xyz qwe').topic, 'Khác');
});
