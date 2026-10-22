import type { PocketLine } from '@lw/game';
import { L } from '../../dsl';

/** Phrase Pocket lines of Release 2 waves C1-C2: the Hikarigaoka trip, the café and station job intros, the festival stalls and the speech: pocket line id -> line. Every line is language an intent of its scenario accepts. */
const P = (id: string, line: PocketLine['line'], key?: true): [string, PocketLine] => [id, key ? { id, line, key } : { id, line }];

export const STORY_POCKETS: Record<string, PocketLine> = Object.fromEntries([
  P('p_trip_hikarigaoka_1', L('おすすめ|は|何|です|か|？', 'What do you recommend?', 'بماذا تنصح؟'), true),
  P('p_trip_hikarigaoka_2', L('お土産|を|ください|。', 'A souvenir, please.', 'هدية تذكارية من فضلك.'), true),
  P('p_trip_hikarigaoka_3', L('公園|は|どこ|です|か|？', 'Where is the park?', 'أين الحديقة؟')),
  P('p_jobintro_cafe_1', L('はい|、|やります|。', 'Yes, I will do it.', 'نعم، سأفعل.')),
  P('p_jobintro_cafe_2', L('いらっしゃいませ|。', 'Welcome!', 'أهلًا بك!'), true),
  P('p_jobintro_cafe_3', L('お客さん|、|お待たせしました|。', 'Sorry to keep you waiting, sir.', 'آسف على الانتظار يا سيدي.'), true),
  P('p_jobintro_station_1', L('はい|、|やります|。', 'Yes, I will do it.', 'نعم، سأفعل.')),
  P('p_jobintro_station_2', L('三番線|です|。', 'It is platform 3.', 'إنه الرصيف 3.'), true),
  P('p_jobintro_station_3', L('どうぞ|、|お気をつけて|。', 'Please, take care.', 'تفضّل، اعتنِ بنفسك.'), true),
  // Release 2 wave C2: the festival stalls and the speech (the speech's lines with the player's own facts are `speechRehearsal`, game/festival.ts)
  P('p_matsuri_stalls_1', L('はい|、|とても|楽しい|です|。', 'Yes, it is a lot of fun.', 'نعم، ممتع جدًا.')),
  P('p_matsuri_stalls_2', L('たこ焼き|を|ください|。', 'Takoyaki, please.', 'تاكوياكي من فضلك.'), true),
  P('p_matsuri_stalls_3', L('現金|で|お願いします|。', 'Cash, please.', 'نقدًا من فضلك.'), true),
  P('p_matsuri_speech_1', L('はじめまして|。', 'Nice to meet you.', 'تشرفنا.')),
  P('p_matsuri_speech_2', L('桜町|は|とても|いい|町|です|。', 'Sakura-chō is a very nice town.', 'ساكورا-تشو مدينة جميلة جدًا.'), true),
  P('p_matsuri_speech_3', L('ありがとうございました|。', 'Thank you very much.', 'شكرًا جزيلًا.'), true),
]);
