// Hang-outs with Madrid's friends at three hearts (Spanish step 4): Sunday's tortilla de patatas with Lucía at the flat (with onion or
// without: Spain's great debate), the Atleti match with Javi at Lola's bar (cheering the goal, groaning at the referee), and a walk in
// the Retiro with Nadia (asking a stranger for a photo, with usted). Each is a little thing done together in tú: helping, reacting,
// choosing. They pay hearts (kind `hangout`, one every few days), never euros.
import type { Scenario } from '../types';
import { L, S, asRecord, node, say } from '../tokyo/dsl';

const YES = ['si', 'claro', 'vale', 'genial', 'venga', 'vamos', 'por supuesto', 'me encanta', 'guay'];

// ---------- Sunday's tortilla with Lucía ----------
const flipNode = (id: string, line: ReturnType<typeof L>) =>
  node({
    id,
    emotion: 'excited',
    say: [say(line)],
    suggestions: [S('¡Allá voy! ¡Uno, dos, tres!', 'Here goes! One, two, three!', 'ها أنا ذا! واحد، اثنان، ثلاثة!'), S('¡Ayúdame, por favor!', 'Help me, please!', 'ساعديني من فضلك!')],
    intents: [{ id: 'flip', any: ['alla voy', 'uno dos tres', 'vuelta', 'ayudame', 'ayuda', 'vale', 'ya'], next: 'taste', step: 'kitchen', ideal: L('¡Allá voy! ¡Uno, dos, tres!', 'Here goes! One, two, three!', 'ها أنا ذا! واحد، اثنان، ثلاثة!') }],
  });

export const HANG_LUCIA: Scenario = {
  id: 'hang_lucia_tortilla',
  locationId: 'mad_piso',
  characterId: 'lucia',
  level: 'A1',
  title: { en: 'Sunday tortilla with Lucía', ar: '«تورتيا» الأحد مع لوسيا' },
  setup: {
    en: 'On Sundays Lucía cooks for the whole flat. Help her make a tortilla de patatas: peel, choose (with onion or without?), flip it, taste it.',
    ar: 'أيام الأحد تطبخ لوسيا لكل سكان الشقة. ساعدها في تحضير «تورتيا» البطاطا: قشّر، واختر (بالبصل أم بدونه؟)، واقلبها، وتذوّقها.',
  },
  minutes: 4,
  steps: [
    { id: 'help', text: { en: 'Offer to help', ar: 'اعرض المساعدة' } },
    { id: 'kitchen', text: { en: 'Peel, choose the onion question, flip the tortilla', ar: 'قشّر، واحسم مسألة البصل، واقلب «التورتيا»' } },
    { id: 'praise', text: { en: 'Say how it tastes', ar: 'قل كيف طعمها' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('¡Hola, {name}! Hoy es domingo y hago una tortilla de patatas. ¿Me ayudas?', 'Hi, {name}! It’s Sunday and I’m making a potato tortilla. Will you help me?', 'أهلًا يا {name}! اليوم الأحد وأحضّر «تورتيا» البطاطا. هل تساعدني؟'))],
      suggestions: [S('¡Sí, claro! ¿Qué hago?', 'Yes, of course! What shall I do?', 'نعم، طبعًا! ماذا أفعل؟'), S('¡Qué rico! Te ayudo.', 'Yum! I’ll help you.', 'لذيذ! سأساعدك.')],
      intents: [{ id: 'help', any: [...YES, 'ayudo', 'ayudar', 'que hago', 'rico'], next: 'potatoes', step: 'help', ideal: L('¡Sí, claro! ¿Qué hago?', 'Yes, of course! What shall I do?', 'نعم، طبعًا! ماذا أفعل؟') }],
    }),
    node({
      id: 'potatoes',
      say: [say(L('¡Genial! Pela las patatas, por favor. Yo corto la cebolla.', 'Great! Peel the potatoes, please. I’ll cut the onion.', 'رائع! قشّر البطاطا من فضلك. أنا أقطّع البصل.'))],
      suggestions: [S('Vale, pelo las patatas.', 'Okay, I’ll peel the potatoes.', 'حسنًا، أقشّر البطاطا.'), S('¡Hecho! Aquí están las patatas.', 'Done! Here are the potatoes.', 'تمّ! هذه هي البطاطا.')],
      intents: [{ id: 'peel', any: ['pelo', 'patatas', 'vale', 'hecho', 'aqui', 'ya esta'], next: 'onion', ideal: L('Vale, pelo las patatas.', 'Okay, I’ll peel the potatoes.', 'حسنًا، أقشّر البطاطا.') }],
    }),
    node({
      id: 'onion',
      emotion: 'neutral',
      say: [say(L('Pregunta importante: ¿tortilla con cebolla o sin cebolla?', 'Important question: tortilla with onion or without?', 'سؤال مهم: «تورتيا» بالبصل أم بدونه؟'))],
      suggestions: [S('Con cebolla, claro.', 'With onion, of course.', 'بالبصل طبعًا.'), S('Sin cebolla, por favor.', 'Without onion, please.', 'بدون بصل من فضلك.')],
      intents: [
        // 「sin」 first: 「sin cebolla」 has 「cebolla」 in it
        { id: 'without', any: ['sin cebolla', 'sin'], next: 'flip_sin', boost: 5 },
        { id: 'with', any: ['con cebolla', 'cebolla', 'con'], none: ['sin'], next: 'flip_con', ideal: L('Con cebolla, claro.', 'With onion, of course.', 'بالبصل طبعًا.') },
      ],
    }),
    flipNode('flip_con', L('¡Eso es! Con cebolla está más jugosa. Ahora, ¡dale la vuelta con el plato!', 'That’s it! With onion it’s juicier. Now flip it over with the plate!', 'هكذا! بالبصل تكون أطرى. والآن اقلبها بالصحن!')),
    flipNode('flip_sin', L('¡Uy, como Javi! Vale, sin cebolla. Ahora, ¡dale la vuelta con el plato!', 'Oh, just like Javi! Okay, without onion. Now flip it over with the plate!', 'أوه، مثل خافي! حسنًا، بدون بصل. والآن اقلبها بالصحن!')),
    node({
      id: 'taste',
      emotion: 'happy',
      say: [say(L('¡Perfecta! Prueba un trozo. ¿Qué tal?', 'Perfect! Try a piece. How is it?', 'ممتازة! تذوّق قطعة. ما رأيك؟'))],
      suggestions: [S('¡Está buenísima!', 'It’s delicious!', 'إنها لذيذة جدًا!'), S('¡Qué rica, Lucía!', 'So tasty, Lucía!', 'ما ألذّها يا لوسيا!')],
      intents: [{ id: 'praise', any: ['buenisima', 'buena', 'rica', 'rico', 'deliciosa', 'me encanta', 'genial', 'perfecta', 'mmm'], next: 'end', step: 'praise', ideal: L('¡Está buenísima!', 'It’s delicious!', 'إنها لذيذة جدًا!') }],
    }),
    node({
      id: 'end',
      end: true,
      emotion: 'happy',
      say: [say(L('¡Gracias por ayudarme, {name}! Los domingos, aquí se come tortilla.', 'Thanks for helping me, {name}! On Sundays, it’s tortilla here.', 'شكرًا لمساعدتي يا {name}! أيام الأحد نأكل «التورتيا» هنا.'))],
      intents: [],
    }),
  ]),
};

// ---------- the Atleti match with Javi ----------
export const HANG_JAVI: Scenario = {
  id: 'hang_javi_partido',
  locationId: 'mad_bar',
  characterId: 'javi',
  level: 'A1',
  title: { en: 'The match with Javi', ar: 'المباراة مع خافي' },
  setup: {
    en: 'Atleti are playing tonight and Javi watches every match at Lola’s bar. Say yes, order something to drink, cheer the goal, groan at the referee.',
    ar: 'أتلتيكو يلعب الليلة وخافي يشاهد كل مباراة في بار لولا. وافق، واطلب مشروبًا، وشجّع عند الهدف، واعترض على الحكم.',
  },
  minutes: 4,
  steps: [
    { id: 'join', text: { en: 'Say yes to the match', ar: 'وافق على المباراة' } },
    { id: 'cheer', text: { en: 'Cheer the goal', ar: 'شجّع عند الهدف' } },
    { id: 'chat', text: { en: 'Say what you thought of the match', ar: 'قل رأيك في المباراة' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'excited',
      say: [say(L('¡Hola, {name}! Esta noche juega el Atleti. ¿Vemos el partido en el bar de Lola?', 'Hi, {name}! Atleti are playing tonight. Shall we watch the match at Lola’s bar?', 'أهلًا يا {name}! أتلتيكو يلعب الليلة. هل نشاهد المباراة في بار لولا؟'))],
      suggestions: [S('¡Sí, vamos!', 'Yes, let’s go!', 'نعم، هيا بنا!'), S('¡Claro! ¿A qué hora?', 'Sure! What time?', 'طبعًا! في أي ساعة؟')],
      intents: [{ id: 'join', any: [...YES, 'a que hora', 'hora', 'partido'], next: 'order', step: 'join', ideal: L('¡Sí, vamos!', 'Yes, let’s go!', 'نعم، هيا بنا!') }],
    }),
    node({
      id: 'order',
      say: [say(L('A las nueve. ¡Ya empieza! Invito yo. ¿Qué tomas?', 'At nine. It’s starting! My treat. What are you having?', 'في التاسعة. ها هي تبدأ! أنا أدعوك. ماذا تشرب؟'))],
      suggestions: [S('Un refresco, por favor.', 'A soft drink, please.', 'مشروبًا غازيًا من فضلك.'), S('Un agua con gas.', 'A sparkling water.', 'ماءً فوّارًا.')],
      intents: [{ id: 'drink', any: ['refresco', 'agua', 'zumo', 'cafe', 'limonada', 'tomo', 'para mi', 'gracias'], next: 'goal' }],
    }),
    node({
      id: 'goal',
      emotion: 'excited',
      say: [say(L('¡Corre, corre! ¡Gol! ¡Gol del Atleti!', 'Run, run! Goal! Atleti score!', 'اركض، اركض! هدف! هدف لأتلتيكو!'))],
      suggestions: [S('¡Gol! ¡Vamos, Atleti!', 'Goal! Come on, Atleti!', 'هدف! هيا يا أتلتيكو!'), S('¡Qué golazo!', 'What a goal!', 'يا له من هدف رائع!')],
      intents: [{ id: 'cheer', any: ['gol', 'golazo', 'vamos', 'bien', 'increible', 'que bueno', 'aupa'], next: 'referee', step: 'cheer', ideal: L('¡Gol! ¡Vamos, Atleti!', 'Goal! Come on, Atleti!', 'هدف! هيا يا أتلتيكو!') }],
    }),
    node({
      id: 'referee',
      emotion: 'surprised',
      say: [say(L('¿Penalti? ¡No! ¡El árbitro no lo ha visto!', 'A penalty? No! The referee didn’t see it!', 'ضربة جزاء؟ لا! الحكم لم يرها!'))],
      suggestions: [S('¡Qué mala suerte!', 'What bad luck!', 'يا لسوء الحظ!'), S('¡Venga, árbitro!', 'Come on, referee!', 'هيا يا حكم!')],
      intents: [{ id: 'groan', any: ['mala suerte', 'venga', 'arbitro', 'que pena', 'madre mia', 'no puede ser', 'vaya'], next: 'win' }],
    }),
    node({
      id: 'win',
      emotion: 'happy',
      say: [say(L('¡Final! ¡Ganamos uno a cero! ¿Te ha gustado el partido?', 'Full time! We won one-nil! Did you enjoy the match?', 'انتهت! فزنا بهدف نظيف! هل أعجبتك المباراة؟'))],
      suggestions: [S('¡Sí, me ha encantado!', 'Yes, I loved it!', 'نعم، أعجبتني كثيرًا!'), S('¡Qué partido más emocionante!', 'What an exciting match!', 'يا لها من مباراة مثيرة!')],
      intents: [{ id: 'opinion', any: ['me ha encantado', 'emocionante', 'genial', 'si', 'me gusta', 'bonito', 'increible', 'buenisimo'], next: 'end', step: 'chat', ideal: L('¡Sí, me ha encantado!', 'Yes, I loved it!', 'نعم، أعجبتني كثيرًا!') }],
    }),
    node({
      id: 'end',
      end: true,
      emotion: 'happy',
      say: [say(L('¡Ya eres del Atleti, {name}! El próximo partido, otra vez aquí.', 'You’re an Atleti fan now, {name}! Next match, here again.', 'أصبحت من مشجعي أتلتيكو يا {name}! المباراة القادمة هنا مرة أخرى.'))],
      intents: [],
    }),
  ]),
};

// ---------- a walk in the Retiro with Nadia ----------
export const HANG_NADIA: Scenario = {
  id: 'hang_nadia_retiro',
  locationId: 'mad_plaza',
  characterId: 'nadia',
  level: 'A1',
  title: { en: 'A walk in the Retiro with Nadia', ar: 'نزهة في «الريتيرو» مع نادية' },
  setup: {
    en: 'A sunny Saturday: Nadia takes you to the Retiro. Admire the lake, ask a stranger to take your photo (with usted: you do not know him), choose an ice cream.',
    ar: 'سبت مشمس: نادية تأخذك إلى حديقة «الريتيرو». استمتع بالبحيرة، واطلب من شخص غريب أن يلتقط لكما صورة (بصيغة الاحترام: أنت لا تعرفه)، واختر المثلجات.',
  },
  minutes: 4,
  steps: [
    { id: 'join', text: { en: 'Say yes to the walk', ar: 'وافق على النزهة' } },
    { id: 'ask', text: { en: 'Ask a stranger for a photo, with usted', ar: 'اطلب من غريب صورة، بصيغة الاحترام' } },
    { id: 'chat', text: { en: 'Say what you like about Madrid', ar: 'قل ما يعجبك في مدريد' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('¡Hola, {name}! Hace un día precioso. ¿Damos un paseo por el Retiro?', 'Hi, {name}! It’s a beautiful day. Shall we take a walk in the Retiro?', 'أهلًا يا {name}! اليوم جميل جدًا. هل نتمشى في حديقة «الريتيرو»؟'))],
      suggestions: [S('¡Sí, me encanta el Retiro!', 'Yes, I love the Retiro!', 'نعم، أحب «الريتيرو» كثيرًا!'), S('¡Vale! ¿Vamos en metro?', 'Okay! Shall we take the Metro?', 'حسنًا! هل نذهب بالمترو؟')],
      intents: [{ id: 'join', any: [...YES, 'metro', 'retiro', 'paseo'], next: 'lake', step: 'join', ideal: L('¡Sí, me encanta el Retiro!', 'Yes, I love the Retiro!', 'نعم، أحب «الريتيرو» كثيرًا!') }],
    }),
    node({
      id: 'lake',
      say: [say(L('Mira, el estanque y las barcas. ¡Qué bonito!', 'Look, the lake and the rowing boats. How lovely!', 'انظر، البحيرة والقوارب. ما أجملها!'))],
      suggestions: [S('¡Precioso! ¿Nos hacemos una foto?', 'Beautiful! Shall we take a photo?', 'جميل جدًا! هل نلتقط صورة؟'), S('Sí, es muy bonito.', 'Yes, it’s very pretty.', 'نعم، إنه جميل جدًا.')],
      intents: [{ id: 'admire', any: ['precioso', 'bonito', 'foto', 'si', 'que bonito', 'me gusta', 'mira'], next: 'photo' }],
    }),
    node({
      id: 'photo',
      say: [say(L('¡Vamos a pedir una foto a ese señor! Pregúntale tú, con usted.', 'Let’s ask that man for a photo! You ask him, with usted.', 'لنطلب من ذلك السيد أن يلتقط لنا صورة! اسأله أنت، بصيغة الاحترام.'))],
      suggestions: [S('Perdone, ¿nos puede hacer una foto?', 'Excuse me, could you take a photo of us?', 'عفوًا، هل يمكنك أن تلتقط لنا صورة؟'), S('Disculpe, ¿nos hace una foto, por favor?', 'Excuse me, would you take a photo of us, please?', 'عذرًا، هل تلتقط لنا صورة من فضلك؟')],
      intents: [{ id: 'ask_photo', any: ['foto', 'perdone', 'disculpe', 'puede', 'podria', 'nos hace'], next: 'icecream', step: 'ask', ideal: L('Perdone, ¿nos puede hacer una foto?', 'Excuse me, could you take a photo of us?', 'عفوًا، هل يمكنك أن تلتقط لنا صورة؟') }],
    }),
    node({
      id: 'icecream',
      emotion: 'happy',
      say: [say(L('¡Muy bien dicho! Y la foto ha salido preciosa. ¿Nos tomamos un helado?', 'Very well said! And the photo came out beautifully. Shall we have an ice cream?', 'أحسنت القول! والصورة جميلة جدًا. هل نتناول المثلجات؟'))],
      suggestions: [S('¡Sí! Yo, de chocolate.', 'Yes! Chocolate for me.', 'نعم! أنا بالشوكولاتة.'), S('Para mí, de fresa.', 'Strawberry for me.', 'لي بالفراولة.')],
      intents: [{ id: 'flavour', any: ['chocolate', 'fresa', 'vainilla', 'limon', 'si', 'helado', 'para mi', 'yo'], next: 'chat' }],
    }),
    node({
      id: 'chat',
      say: [say(L('Oye, ¿qué es lo que más te gusta de Madrid?', 'Hey, what do you like most about Madrid?', 'قل لي، ما أكثر ما يعجبك في مدريد؟'))],
      suggestions: [S('La gente, es muy simpática.', 'The people, they’re very friendly.', 'الناس، إنهم لطفاء جدًا.'), S('Los parques y las plazas.', 'The parks and the squares.', 'الحدائق والساحات.')],
      intents: [{ id: 'opinion', any: ['gente', 'simpatica', 'parques', 'plazas', 'comida', 'barrio', 'todo', 'me gusta', 'retiro'], next: 'end', step: 'chat', ideal: L('La gente, es muy simpática.', 'The people, they’re very friendly.', 'الناس، إنهم لطفاء جدًا.') }],
    }),
    node({
      id: 'end',
      end: true,
      emotion: 'happy',
      say: [say(L('¡A mí también! Gracias por el paseo, {name}.', 'Me too! Thanks for the walk, {name}.', 'وأنا أيضًا! شكرًا على النزهة يا {name}.'))],
      intents: [],
    }),
  ]),
};

export const ES_HANGOUTS: Scenario[] = [HANG_LUCIA, HANG_JAVI, HANG_NADIA];
