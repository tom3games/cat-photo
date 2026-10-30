// ねこカメラマン / CAT PHOTOGRAPHER の文言・データ（日英）
window.NC_DATA = {
  // 猫3匹（オリジナル柄。pat は game.js の柄の関数名）
  CATS: [
    { id: 'mugi', ja: 'むぎ', en: 'Mugi', pat: 'tabby', base: '#e8953f', dark: '#b4602a', light: '#fbe3c4', eye: '#7fae3a', size: 1.0 },
    { id: 'mochi', ja: 'おもち', en: 'Mochi', pat: 'tux', base: '#2b2a30', dark: '#16151a', light: '#f6f3ee', eye: '#e3b83c', size: 1.06 },
    { id: 'dango', ja: 'だんご', en: 'Dango', pat: 'calico', base: '#f7f1e6', dark: '#2f2a28', light: '#e4913f', eye: '#5fa4c9', size: 0.92 },
  ],
  // 瞬間の価値（v）。hold は「ずっと続く」ポーズ（タイミングの良し悪しが無い）
  MOM: {
    walk: { v: 5, hold: 1, ja: 'おさんぽ', en: 'Strolling' },
    sit: { v: 10, hold: 1, ja: 'おすわり', en: 'Just sitting' },
    loaf: { v: 22, hold: 1, ja: '香箱座り', en: 'Loaf mode' },
    sleep: { v: 30, hold: 1, ja: 'へそ天', en: 'Belly up' },
    shy: { v: 26, hold: 1, ja: '何もなかった顔', en: 'Nothing happened' },
    yawn: { v: 62, ja: 'あくび', en: 'Big yawn' },
    stretch: { v: 48, ja: 'のび〜', en: 'Big stretch' },
    look: { v: 70, ja: 'こっち見た', en: 'Eye contact' },
    box: { v: 58, ja: 'ひょっこり', en: 'Box peek' },
    flehmen: { v: 96, ja: '変顔', en: 'Stink face' },
    jumpfail: { v: 86, ja: 'ジャンプ失敗', en: 'Jump fail' },
    stand: { v: 66, ja: '立っち', en: 'Stand-up swat' },
  },
  // 合計点の称号（下から）。min 以上
  TIERS: [
    { id: 'bad', min: 0, ja: 'ただの床の写真', en: 'Photos of a Floor', col: '#7b6f66' },
    { id: 'meh', min: 70, ja: '待ち受け止まり', en: 'Lock Screen at Best', col: '#4f7fa8' },
    { id: 'good', min: 150, ja: 'SNSで300いいね', en: '300 Likes', col: '#e0762e' },
    { id: 'great', min: 270, ja: '猫雑誌の表紙', en: 'Magazine Cover', col: '#d23b54' },
    { id: 'legend', min: 370, ja: '猫写真集デビュー', en: 'Photo Book Debut', col: '#c9971a' },
  ],
  SPECIAL: {
    forgot: { ja: 'シャッター押し忘れ', en: 'Forgot to Shoot', col: '#6b6b6b' },
    blurry: { ja: '全部ブレてる', en: 'All Blurry', col: '#7a5aa8' },
    butt: { ja: 'おしり写真家', en: 'Butt Photographer', col: '#c4627a' },
  },
  TXT: {
    ja: {
      title1: 'ねこ', title2: 'カメラマン', sub: '気まぐれな猫の「一番かわいい瞬間」を撮れ。<br>フィルムは5枚だけ。',
      start: '撮影スタート', how: 'あそびかた', back: 'もどる', go: 'はじめる', lang: 'EN',
      howT: 'あそびかた',
      h1t: '構える', h1pc: 'ドラッグか矢印キーでファインダーを動かす', h1sp: '画面をなぞってファインダーを動かす',
      h2t: '撮る', h2pc: 'スペースかシャッターボタン。フィルムは5枚', h2sp: '丸いシャッターをタップ。フィルムは5枚',
      h3t: '前ぶれを読む', h3: '耳がぴくっ・しっぽゆらゆら。その直後が一番かわいい',
      h4t: 'ブレに注意', h4pc: '猫が動いている時と、構えを振っている時はブレる。Zキーで2倍ズーム', h4sp: '猫が動いている時と、構えを振っている時はブレる。虫めがねで2倍',
      scoreRule: 'かわいさ ＝ ポーズ × タイミング × 構図 × ブレのなさ。持ち時間60秒',
      film: 'フィルム', time: 'のこり', ready: 'かまえて…', goTxt: 'スタート！', end: 'そこまで！', last: 'ラスト1枚',
      hint: '耳ぴく・しっぽゆらゆら＝もうすぐかわいい', snap: 'パシャ', wind: 'ジーッ', empty: 'カチッ…',
      dev: '現像中…', devSub: '写真屋さんが焼いています', resT: 'できあがった写真', total: '合計',
      again: 'もう一回', save: '画像を保存', toTitle: 'タイトル', skip: 'タップで飛ばす', saved: '保存しました',
      best: 'ベスト', miracle: '奇跡の1枚', unshot: '撮り忘れ', pts: '点', editor: '週刊ふみふみ 編集長',
      bubShy: '…見てた？', bubStink: 'くさっ', bubBox: 'ガサガサ', bubSlip: 'ズルッ', bubThud: 'ドテッ', bubPounce: 'シュッ',
      tags: { blur: 'ブレ', butt: 'おしり', cut: '見切れ', far: '遠い', early: '早すぎ', late: 'おそかった', none: '猫いない', two: '2匹', double: 'ダブルあくび' },
      cardFoot: 'tom3games.github.io/cat-photo',
    },
    en: {
      title1: 'CAT', title2: 'PHOTOGRAPHER', sub: 'Catch the cutest moment of moody cats.<br>You only have 5 shots.',
      start: 'Start Shooting', how: 'How to Play', back: 'Back', go: 'Start', lang: 'JA',
      howT: 'How to Play',
      h1t: 'Aim', h1pc: 'Drag or use arrow keys to move the viewfinder', h1sp: 'Swipe the screen to move the viewfinder',
      h2t: 'Shoot', h2pc: 'Space or the shutter button. 5 shots only', h2sp: 'Tap the round shutter. 5 shots only',
      h3t: 'Read the signs', h3: 'Ear twitch, tail swish. The cute moment comes right after',
      h4t: 'Avoid blur', h4pc: 'Moving cats and a swinging camera mean blur. Z for 2x zoom', h4sp: 'Moving cats and a swinging camera mean blur. Lens icon for 2x',
      scoreRule: 'Cuteness = pose x timing x framing x sharpness. 60 seconds',
      film: 'FILM', time: 'TIME', ready: 'Get ready...', goTxt: 'Go!', end: 'Time!', last: 'Last shot',
      hint: 'Ear twitch + tail swish = cuteness incoming', snap: 'SNAP', wind: 'WHIRR', empty: 'click...',
      dev: 'Developing...', devSub: 'The photo shop is printing', resT: 'Your Prints', total: 'TOTAL',
      again: 'Again', save: 'Save Image', toTitle: 'Title', skip: 'Tap to skip', saved: 'Saved',
      best: 'BEST', miracle: 'Miracle', unshot: 'No shot', pts: 'pts', editor: 'Editor-in-chief, Weekly Purr',
      bubShy: '...you saw?', bubStink: 'EWW', bubBox: 'rustle', bubSlip: 'SLIP', bubThud: 'THUD', bubPounce: 'SWISH',
      tags: { blur: 'Blur', butt: 'Butt', cut: 'Cut off', far: 'Too far', early: 'Too early', late: 'Too late', none: 'No cat', two: '2 cats', double: 'Double yawn' },
      cardFoot: 'tom3games.github.io/cat-photo',
    },
  },
  // 編集長の一言（称号ごとに3つ）
  EDITOR: {
    legend: {
      ja: ['表紙はこれで決まり。来月から連載ね。', '印刷所に電話したわ。初版10万部よ。', '…泣いた。あなた、猫の神様に愛されてる。'],
      en: ['This is the cover. Your column starts next month.', 'I called the printer. First run: 100,000 copies.', '...I cried. The cat gods love you.'],
    },
    great: {
      ja: ['見開き2ページあげる。惜しいのは1枚だけね。', 'うちの表紙、来週はあなたよ。', '猫の気持ちが分かってるじゃない。'],
      en: ['You get a two-page spread. Only one shot let you down.', 'Next week\'s cover is yours.', 'You actually understand cats.'],
    },
    good: {
      ja: ['いいじゃない。読者投稿コーナーに載せとくわ。', 'スマホの待ち受けより、ちょっと上ね。', 'かわいい。でも猫はもっとかわいいのよ。'],
      en: ['Nice. It goes in the reader submissions page.', 'A notch above a lock screen.', 'Cute. But the cats are cuter than this.'],
    },
    meh: {
      ja: ['うーん、親戚の集まりで見せる写真ね。', '猫、写ってはいる。写ってはいるわ。', '次は猫の顔を撮りましょうね。'],
      en: ['Hmm. Photos you show at a family reunion.', 'There is a cat in it. Technically.', 'Next time, try the face.'],
    },
    bad: {
      ja: ['これ…床の写真？猫はどこ？', 'フローリングの写真集なら出せるわよ。', '猫が逃げたんじゃない、あなたが外したのよ。'],
      en: ['Is this... the floor? Where is the cat?', 'I could publish a book of floorboards.', 'The cats didn\'t run. You missed.'],
    },
    blurry: {
      ja: ['心霊写真の特集号に回しておくわ。', 'これは…猫の残像ね。', '手ぶれ補正、買いましょうか。'],
      en: ['I\'ll file these under ghost photos.', 'These are... cat afterimages.', 'Maybe buy a tripod.'],
    },
    forgot: {
      ja: ['フィルム、1枚も使ってないわよ？', '見てるだけで満足しちゃった？', 'シャッターは押すものよ。'],
      en: ['You didn\'t use a single frame.', 'Just watching was enough for you?', 'The shutter is meant to be pressed.'],
    },
    butt: {
      ja: ['おしりの写真集…意外と売れるかも。', '全部おしり。ある意味、才能ね。', '猫に嫌われてるんじゃない？'],
      en: ['A book of cat butts... might sell, actually.', 'All butts. A talent, in a way.', 'I think the cats are avoiding you.'],
    },
    miracle: { ja: 'この奇跡の1枚だけで元が取れたわ。', en: 'That miracle shot alone paid for the film.' },
  },
}
