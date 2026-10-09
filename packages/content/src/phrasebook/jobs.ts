import type { PhraseEntry } from '../types';
import { P } from './helpers';

/** Phrases for the jobs module (the intro with Tanaka). English is written without contractions; ids must be unique across modules. */
export const JOBS_PHRASES: PhraseEntry[] = [
  P(
    'job_yes_do_it',
    'はい|、|やります。',
    ['yes i will do it', 'yes i will', 'i will do it', 'yes i will help', 'yes i will help out', 'i will help out', 'i will help', 'yes i can help'],
    ['نعم سافعل', 'نعم سأفعل', 'سأفعل ذلك', 'نعم سأساعد', 'سأساعد'],
  ),
  P(
    'job_what_help',
    'どんな|お手伝い|です|か？',
    ['what kind of help', 'what kind of helping out', 'what kind of work is it', 'what do i have to do', 'what will i do'],
    ['اي نوع من المساعدة', 'أي نوع من المساعدة', 'ما نوع العمل', 'ماذا سافعل', 'ماذا سأفعل'],
  ),
  P(
    'job_welcome',
    'いらっしゃいませ。',
    ['welcome', 'welcome to the shop', 'welcome to our store', 'welcome in', 'irasshaimase'],
    ['اهلا بك', 'أهلا بك', 'اهلا بك في المتجر', 'أهلا بك في المتجر'],
  ),
  P(
    'job_thank_you_very_much',
    'ありがとうございました。',
    ['thank you for coming', 'thank you for your purchase', 'thanks for coming', 'arigatou gozaimashita'],
    ['شكرا لزيارتك', 'شكرا على الشراء', 'شكرا لقدومك'],
  ),
];
