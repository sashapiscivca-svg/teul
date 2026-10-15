import type { FeelingsView } from '../src/feel';

/** A small town's feelings: a dear friend, a couple out on a date, two who fell out. */
export const talkFixture: FeelingsView = {
  residents: [
    { id: 'res_1', mood: 'content', why: 'day' },
    { id: 'res_2', mood: 'in_love', why: 'love', with: 'res_3', love: 'res_3' },
    { id: 'res_3', mood: 'in_love', why: 'love', with: 'res_2', love: 'res_2' },
    { id: 'res_4', mood: 'cross', why: 'quarrel', cross: ['res_5'] },
    { id: 'res_5', mood: 'sad', why: 'quarrel', cross: ['res_4'] },
  ],
  ties: [
    { a: 'res_2', b: 'res_3', kind: 'courting', state: 'fine', days: 4 },
    { a: 'res_4', b: 'res_5', kind: 'friends', state: 'quarrel', days: 0 },
  ],
  warmth: [
    { id: 'res_1', name: 'Петро Бондар', level: 'warm', words: 'Завжди тепло вітається і питає, як справи.', greet: 'Привіт!', gift: false, faded: false, people: ['дружить з Оленою'], today: 'у доброму гуморі' },
    { id: 'res_9', name: 'Олена Ткач', level: 'dear', words: 'Рідна душа в Липовому.', greet: 'Сонечко!', confide: 'Я пишу вірші.', gift: true, faded: false, people: [], today: 'сяє від радості' },
    { id: 'res_7', name: 'Хтось Незнайомий', level: 'stranger', words: 'Ще не знайомі.', greet: 'Добрий день.', gift: false, faded: false, people: [], today: 'спокійний день' },
  ],
  gossip: ['Кажуть, Ігор і Марта посварилися через кота.'],
};
