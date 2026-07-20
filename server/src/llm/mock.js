// —— 模拟版 LLM ——
// 不联网、不花钱：用关键词推断心情，从预写模板里挑一封温暖的回信。
// 输入输出格式与将来的真 Claude provider 完全一致：
//   输入 { entry, tone, name } → 输出 { reflection, mood: { key, emoji, label } }
import { MOODS } from '../moods.js';

const CJK_RE = /[㐀-䶿一-鿿]/;

// 每种心情的触发词（中英混排，全部小写匹配）。命中越多，得分越高。
const KEYWORDS = {
  overloaded: [
    'overwhelm', 'too much', 'so much', 'burned out', 'burnt out',
    'deadline', 'no time', 'so busy', 'chaos', 'brain is full', 'fried',
    '太多', '崩溃', '爆炸', '忙疯', '加班', '卷',
  ],
  sad: [
    'hurt', 'sad', 'cry', 'cried', 'reject', 'failed', 'lonely', 'upset',
    'anxious', 'worried', 'scared', 'awful', 'terrible', 'miss her', 'miss him',
    '难过', '委屈', '哭', '受伤', '失败', '焦虑', '害怕', '孤独', '心碎',
  ],
  thrilled: [
    'excited', 'amazing', 'awesome', 'finally', 'so happy', 'best day',
    'yay', 'woohoo', 'aha', 'passed', 'got the job', 'incredible',
    'proud', 'finished', 'shipped', 'did it', 'solved',
    '开心', '兴奋', '太棒', '终于', '激动', '好耶', '完成', '搞定', '做到了', '解决',
  ],
  at_peace: [
    'calm', 'peace', 'quiet', 'relax', 'rested', 'slow day', 'a walk',
    'tea', 'gentle', 'settled', 'grounded', 'breathe', 'content',
    '平静', '安静', '放松', '踏实', '散步', '安稳', '舒服', '满足',
  ],
  warm: [
    'loved', 'grateful', 'gratitude', 'sweet', 'warm', 'hug', 'kind',
    'thank', 'together', 'my friend', 'family', 'she said', 'he said',
    '感动', '温暖', '被爱', '拥抱', '谢谢', '陪我', '家人', '朋友对我', '甜',
  ],
  frustrated: [
    'frustrat', 'annoy', 'angry', 'mad at', 'irritat', 'stuck', 'ugh',
    'argh', 'hate', 'unfair', 'why would', 'so dumb',
    '烦', '气死', '生气', '卡住', '讨厌', '凭什么', '烦躁', '无语',
  ],
  drained: [
    'tired', 'sleepy', 'drained', 'no energy', 'worn out', 'exhaust',
    'low battery', 'can barely', 'need sleep',
    '好累', '累死', '困', '没劲', '疲惫', '提不起劲', '乏', '没电',
  ],
  meh: [
    'meh', 'whatever', 'boring', 'nothing much', 'nothing happened', 'bland',
    'i guess', 'same as always', '无聊', '一般', '还行吧', '平平', '没什么',
  ],
};

// 回信模板。{name} 会被替换成用户的名字。
// 声音基调（PRD 7）：温暖的导师 / 可靠的朋友——先接住情绪，再轻轻托一把，不说教。
const TEMPLATES = {
  en: {
    plain: {
      at_peace: [
        "It sounds like today found its own quiet rhythm. You weren't chasing anything, and that's not laziness — that's rest doing its work. Hold onto this feeling.",
        "A settled day. You don't need something dramatic to make a day count — being grounded like this is its own kind of progress.",
      ],
      thrilled: [
        "I can feel the energy in your words. Days like this are fuel — bottle a little of it for the slower ones.",
        "That's a real win, {name}. Small or not, you moved something forward today, and you're allowed to feel good about it.",
      ],
      warm: [
        "What a warm thing to get to feel. Let it soak in properly — moments like this are why the rest of it is worth doing.",
        "Someone or something reached you today, {name}. Don't rush past it; being loved counts as an event.",
      ],
      meh: [
        "Not every day has a headline, and that's fine. You still showed up and wrote something down — flat days pass more gently when you don't fight them.",
        "Sometimes there aren't good words, and a few messy ones are enough. You showed up here, and that counts.",
      ],
      overloaded: [
        "That's a lot for one person to carry in one day. You don't have to sort it all out tonight — naming it here is already a way of setting some of it down.",
        "Too much came at you today. Be gentle with yourself this evening; the pile will still be there tomorrow, and you'll be better rested to face it.",
      ],
      sad: [
        "That sounds like it stung, and I won't pretend otherwise. Getting hurt doesn't mean you did it wrong — it usually means you showed up. Be kind to yourself tonight.",
        "Some days leave marks. You made it through this one, {name}, and writing it down instead of swallowing it is its own quiet strength.",
      ],
      frustrated: [
        "That kind of friction wears anyone down. You're allowed to be annoyed — naming it here beats carrying it clenched.",
        "Ugh indeed. Some days push back hard. Set it down for tonight; you don't owe the problem your evening too.",
      ],
      drained: [
        "You sound like you're running on empty. That's not weakness — that's a body asking for rest. Give it an early night if you can.",
        "Low battery days happen, {name}. Nothing needs solving tonight except sleep.",
      ],
    },
    poetic: {
      at_peace: [
        "Still water holds the whole sky. Today, it seems, you set the cup down and let it settle — nothing to fix, nothing to chase. Let the evening stay this wide.",
        "The ink has dried without smudging today. Sit inside this calm a while longer; it asked nothing of you, and it owes you nothing back.",
      ],
      thrilled: [
        "Your words arrive like sparks off a flint. Days this bright don't need interpreting — just stand in the light of it a moment longer.",
        "One firm stroke on the page — that was today. However small it looks from the outside, you pressed the seal down, and it left a mark.",
      ],
      warm: [
        "Warmth like this is slow ink — it spreads quietly until the whole page is soft. Let it keep spreading tonight.",
        "Today the world leaned close and stayed a while. Fold this feeling into your sleeve; it keeps.",
      ],
      meh: [
        "Blank paper is still paper. A day without weather is not a day wasted — it is the rest between two brushstrokes.",
        "Some things sit outside the reach of words, and that's where you are tonight. The empty space on a page is still part of the painting.",
      ],
      overloaded: [
        "Too many brushes, one hand. When everything shouts at once, nothing needs answering tonight — set the load by the door; it will keep until morning.",
        "The page is crowded and the ink is running together. Step back from the desk, {name}. Even rivers in flood settle by dawn.",
      ],
      sad: [
        "Some days write on us instead. The mark stings now, but paper that has taken ink is stronger where it dried. Rest — you don't have to be mended by morning.",
        "A bruise is proof you were somewhere real. Let tonight be a soft place; the healing doesn't need your help, only your patience.",
      ],
      frustrated: [
        "The brush caught on the paper again and again today. Not every grain runs your way — rest the hand, and the stroke will come easier tomorrow.",
        "A knot pulls tighter the more tired the fingers. Leave it on the table tonight; knots loosen for rested hands.",
      ],
      drained: [
        "The ink is thin tonight because the well is low. Wells refill in the dark — go rest, and let it happen.",
        "Even the tide steps back twice a day, and no one calls it giving up. Ebb tonight; return tomorrow.",
      ],
    },
  },
  zh: {
    plain: {
      at_peace: [
        '今天听起来是安稳的一天。不追赶什么、心里踏实，这本身就很珍贵——好好享受这份平静。',
      ],
      thrilled: [
        '隔着字都能感觉到你的开心。这样的日子是燃料——记住这种感觉，留给以后那些走得慢的日子。',
      ],
      warm: [
        '今天有暖意找到了你。别急着翻页，多停一会儿——被爱、被善待，这些都算正经大事。',
      ],
      meh: [
        '不是每天都有大事发生，平平的一天也没关系。你还是来写了几句——淡的日子，不较劲就过得快。',
        '有时候确实找不到合适的词，几个乱糟糟的字就够了。你来了，写了，这就够了。',
      ],
      overloaded: [
        '今天塞进来的东西太多了。不用今晚全部理清楚，把它们写在这里，就已经是放下了一部分。对自己温柔一点。',
      ],
      sad: [
        '听起来今天挺疼的，我不想假装它不疼。受伤不代表你做错了什么。今晚好好休息——你已经撑过来了。',
      ],
      frustrated: [
        '这种反复磨人的烦，搁谁都会累。你可以烦——写在这里，总好过一直攥在手里。',
      ],
      drained: [
        '听起来电量见底了。这不是脆弱，是身体在喊休息。今晚能早点睡就早点睡。',
      ],
    },
    poetic: {
      at_peace: [
        '水静下来，才照得见整片天。今天你把杯子放下了——什么都不用修，什么都不用追。让这个晚上就这样宽宽的。',
      ],
      thrilled: [
        '你的字里都是火星子。这么亮的日子不需要解释——多站在这份光里一会儿。',
      ],
      warm: [
        '暖是慢墨，落下去一点点，就把整页都洇软了。今晚就让它慢慢晕开吧。',
      ],
      meh: [
        '天色淡，墨也淡。不是每一页都要写诗——这一页，翻过去就好。',
        '有些事落在语言够不到的地方。留白也是画的一部分。',
      ],
      overloaded: [
        '笔太多，手只有一双。都在喊的时候，今晚可以谁都不应。把担子放在门边，它等得到天亮。',
      ],
      sad: [
        '有些日子反过来在我们身上落笔。现在还疼，但吃过墨的纸，干了之后反而更结实。今晚不用急着好起来。',
      ],
      frustrated: [
        '今天笔总是被纸绊住。不是每道纹路都顺你的方向——手歇一歇，明天那一笔会顺一些。',
      ],
      drained: [
        '墨淡，是因为井低了。井是在黑夜里慢慢回满的——去睡吧，剩下的交给夜。',
      ],
    },
  },
};

function detectLang(entry) {
  return CJK_RE.test(entry) ? 'zh' : 'en';
}

function inferMood(entry) {
  const text = entry.toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const [mood, words] of Object.entries(KEYWORDS)) {
    let score = 0;
    for (const w of words) {
      if (text.includes(w)) score += 1;
    }
    if (score > bestScore) {
      best = mood;
      bestScore = score;
    }
  }
  // 一个词都没命中 = 读不出情绪 → 兜底 meh（PRD 7：宁可坦白说读不出，不要瞎猜）
  return best ?? 'meh';
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function reflect({ entry, tone, name }) {
  // 故意模拟真 API 的响应时间，让前端的加载体验从第一天起就是真实的
  await new Promise((r) => setTimeout(r, 700 + Math.random() * 600));

  const lang = detectLang(entry);
  const moodKey = inferMood(entry);
  const template = pick(TEMPLATES[lang][tone][moodKey]);
  const fallbackName = lang === 'zh' ? '朋友' : 'friend';
  const reflection = template.replaceAll('{name}', (name || fallbackName).toLowerCase());

  const m = MOODS[moodKey];
  return {
    reflection,
    mood: { key: moodKey, emoji: m.emoji, label: lang === 'zh' ? m.zh : m.label },
  };
}
