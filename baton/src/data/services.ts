import type { ProfileField, Service } from '../types';

/** 会社名・担当者名・メール・役職（全サービス共通の土台） */
const BASE_PROFILE: ProfileField[] = [
  { id: 'company', label: '会社名', type: 'text', required: true },
  { id: 'name', label: 'ご担当者名', type: 'text', required: true },
  { id: 'email', label: 'メールアドレス', type: 'email', required: true },
  {
    id: 'role',
    label: '役職',
    type: 'select',
    required: true,
    options: ['代表取締役', '取締役', '役員', '事業責任者', '管理職', '担当者', 'その他'],
  },
];

/** 上記＋資本金（テクフリ・Standment のみ） */
const PROFILE_WITH_CAPITAL: ProfileField[] = [
  ...BASE_PROFILE,
  {
    id: 'capital',
    label: '資本金',
    type: 'select',
    required: true,
    options: ['1,000万円未満', '1,000万〜5,000万円', '5,000万〜1億円', '1億円以上', '非公開'],
  },
];

/** 全サービス共通・アンケート末尾（ひとこと＋連絡方法）は survey.ts 側で固定表示 */
export const CONTACT_METHODS = ['メール', '電話', 'いまは資料だけ'] as const;

export const services: Service[] = [
  {
    id: 'engineer',
    slug: 'engineer',
    company: '株式会社アイデンティティー',
    serviceName: 'テクフリ',
    tagline: 'ITエンジニア・クリエイター 24,000名から',
    description:
      'ITエンジニア・クリエイターに特化した人材支援を行い、フリーランス人材紹介サービス「テクフリ」を運営。必要なスキルを、必要なタイミングで確保できるよう支援しています。',
    theme: { primary: '#1A4FA0', accent: '#4A86D8', bg: '#F7FAFF', text: '#16233A' },
    problems: [
      { title: 'IT人材が足りない', detail: '開発・制作リソースが不足している' },
      { title: '採用に時間がかかる', detail: '急ぎの案件に間に合わない' },
      { title: 'スキル要件に合う人が見つからない', detail: '専門人材の見極めが難しい' },
      { title: '柔軟な体制を組みにくい', detail: '業務委託と正社員の最適化に悩む' },
    ],
    features: [
      { title: 'テクフリ', detail: 'フリーランスIT人材紹介サービス' },
      { title: 'エンジニア支援', detail: '開発人材をスピーディーに提案' },
      { title: 'クリエイター支援', detail: 'デザイナー・PMなどにも対応' },
      { title: '業務委託人材紹介', detail: '必要な期間・体制で参画を支援' },
      { title: '正社員転換対応', detail: '業務委託から採用化まで支援' },
      { title: 'マッチング・フォロー', detail: '企業と人材の相性を重視' },
    ],
    strengths: [
      { title: 'IT領域特化', detail: 'エンジニア・クリエイター領域に強い' },
      { title: '提案スピード', detail: '最短30分で候補者提案が可能' },
      { title: '人材プール', detail: '24,000名以上の保有人材を活用' },
      { title: '柔軟な活用', detail: '業務委託から正社員転換まで対応' },
    ],
    stats: [
      { label: '保有人材', value: '24,000', unit: '名以上' },
      { label: '人材提案スピード', value: '30', unit: '分（最短）' },
      { label: '業務委託→正社員転換', value: '対応可', unit: '' },
    ],
    links: [
      { label: '会社HP', url: 'https://id-entity.jp/' },
      { label: 'テクフリ', url: 'https://freelance.techcareer.jp/' },
    ],
    survey: {
      questions: [
        {
          id: 'q1',
          label: '足りていない職種はどれですか',
          type: 'multi',
          options: [
            'フロントエンド',
            'バックエンド',
            'インフラ・SRE',
            'PM・ディレクター',
            'デザイナー',
            'まだ固まっていない',
          ],
        },
        {
          id: 'q2',
          label: '人が必要になるのはいつ頃ですか',
          type: 'single',
          options: ['今すぐ', '1ヶ月以内', '3ヶ月以内', '半年以内', '未定'],
        },
        {
          id: 'q3',
          label: '採用で困っていることはどれが近いですか',
          type: 'multi',
          options: [
            '応募が集まらない',
            'スキルの見極めが難しい',
            '単価が高い',
            '採用に時間がかかる',
            '稼働開始まで待てない',
          ],
        },
        {
          id: 'q4',
          label: '知りたいことはどれですか',
          type: 'multi',
          options: [
            '単価の相場',
            '提案までのスピード',
            '人材の経歴や質',
            '業務委託から正社員への転換',
            '契約と稼働の流れ',
          ],
        },
      ],
      profileFields: PROFILE_WITH_CAPITAL,
    },
  },

  {
    id: 'webgl',
    slug: 'webgl',
    company: 'Standment',
    serviceName: 'Standment',
    tagline: '見るサイトから、体験するサイトへ',
    description:
      'WebGL・3D・アニメーション技術で、企業やブランドの魅力を「体験」として伝えるWebサイトを制作します。企画・デザイン・実装まで一貫対応。',
    theme: { primary: '#1B3A6B', accent: '#2E9BA8', bg: '#F5F8FC', text: '#14233D' },
    heavyWebGL: true,
    problems: [
      { title: 'サイトが埋もれる', detail: '一般的なWebサイトでは印象に残りにくい' },
      { title: '魅力が伝わらない', detail: '強み・世界観・技術力を表現しきれない' },
      { title: '問い合わせにつながりにくい', detail: '滞在時間や回遊性が伸びにくい' },
      { title: '採用・営業で差別化しづらい', detail: '競合と似た見え方になりやすい' },
    ],
    features: [
      { title: 'WebGLサイト制作', detail: 'コーポレートサイト・LPを3D表現で制作' },
      { title: '企画・演出設計', detail: 'ブランド体験や世界観の見せ方を設計' },
      { title: 'UI/UXデザイン', detail: '使いやすさと没入感を両立' },
      { title: '実装・開発', detail: 'WebGL・フロントエンド・アニメーション実装' },
      { title: '改善・運用支援', detail: '公開後の改善提案や更新もサポート' },
      { title: '営業・採用活用支援', detail: '提案資料・会社紹介・採用広報との連動' },
    ],
    strengths: [
      { title: '体験設計に強い', detail: 'ただ作るだけでなく印象に残る体験を設計' },
      { title: '表現と成果を両立', detail: '見た目だけでなく導線や訴求も重視' },
      { title: '企画から実装まで一貫', detail: '要件整理から公開までまとめて支援' },
      { title: '中小企業・地方企業とも好相性', detail: '差別化したい企業の訴求強化に' },
    ],
    stats: [
      { label: '対応領域', value: '3D', unit: '', note: 'WebGL体験型サイト制作' },
      { label: '対応範囲', value: '企画〜開発', unit: '', note: 'UI/UX・アニメーション・実装まで' },
      { label: '活用シーン', value: '幅広く', unit: '', note: 'ブランディング・集客・採用広報' },
    ],
    links: [
      {
        label: '制作実績',
        url: 'https://savers-japan-digital.pearly-cedar-3983.chatgpt.site/#experience',
      },
    ],
    survey: {
      questions: [
        {
          id: 'q1',
          label: '今のサイトはいつ作られましたか',
          type: 'single',
          options: ['1年以内', '2〜3年前', '4年以上前', '制作中', 'まだない'],
        },
        {
          id: 'q2',
          label: 'サイトで一番やりたいことはどれですか',
          type: 'single',
          options: [
            '会社やブランドの世界観を伝える',
            '問い合わせを増やす',
            '採用の応募を増やす',
            '商談や展示会で使う',
            '競合と差をつける',
          ],
        },
        {
          id: 'q3',
          label: 'いま感じていることはどれが近いですか',
          type: 'multi',
          options: [
            '他社と似ていて埋もれる',
            '技術力や強みが伝わらない',
            'すぐ離脱される',
            '更新が止まっている',
            '制作会社の提案が物足りない',
          ],
        },
        {
          id: 'q4',
          label: '想定している予算はどのくらいですか',
          type: 'single',
          options: ['〜100万円', '100〜300万円', '300〜500万円', '500万円〜', 'これから検討'],
        },
      ],
      profileFields: PROFILE_WITH_CAPITAL,
    },
  },

  {
    id: 'system',
    slug: 'system',
    company: '株式会社ZOOA',
    serviceName: 'ZOOA',
    tagline: '人とシステムの両面から、開発を支える',
    description:
      'エンジニア支援と受託開発の両輪で、企業のIT課題を解決するシステム開発会社。エンジニアリソースの提供から、業務システムの企画・開発、AI活用支援まで対応しています。',
    theme: { primary: '#E8621C', accent: '#F59B4A', bg: '#FFF9F4', text: '#2A1A0F' },
    problems: [
      { title: 'エンジニアが足りない', detail: '開発案件はあるのに社内リソースが不足' },
      { title: '業務がアナログ', detail: '紙・手作業・属人的運用で非効率になっている' },
      { title: 'システム化を進めたい', detail: '業務改善に向けた企画・開発を相談したい' },
      { title: 'AI活用が進まない', detail: '既存システムにAIをどう組み込むか悩む' },
    ],
    features: [
      { title: 'SEサービス事業', detail: '開発案件を抱える企業へエンジニアリソースを提供' },
      { title: 'ITシステム受託開発', detail: '業務システムの企画・開発に対応' },
      { title: 'AI研究開発事業', detail: 'AI活用や既存システムへのAI搭載を支援' },
      { title: '業務DX支援', detail: 'アナログ業務や非効率な工程をシステムで改善' },
      { title: 'ソーシャルゲーム運営', detail: 'ゲーム領域の運営・開発も事業として展開' },
      { title: 'IT/AI相談対応', detail: '新規システム導入やIT関連の相談に対応' },
    ],
    strengths: [
      { title: '人とシステムの両面支援', detail: 'エンジニア支援と受託開発の両輪で対応' },
      { title: '幅広いIT/AI対応', detail: 'IT関連の困りごとからAI搭載まで相談可能' },
      { title: 'チームワーク重視', detail: '技術者同士が知恵を出し合う協力体制' },
      { title: '顧客課題に最適化', detail: '企業ごとの課題に応じて最良の提案を目指す' },
    ],
    stats: [
      {
        label: '事業領域',
        value: '4',
        unit: '事業',
        note: 'SEサービス・受託開発・AI研究開発・ソーシャルゲーム運営',
      },
      { label: '相談対応', value: 'IT・AI', unit: '', note: '新規システム導入からAI活用まで' },
      { label: '対応業種', value: '幅広く', unit: '', note: 'SaaS・SIer・ITコンサル・製造業・建設業など' },
    ],
    links: [{ label: '会社HP', url: 'https://zooa.co.jp/' }],
    survey: {
      questions: [
        {
          id: 'q1',
          label: 'いまの状況に一番近いのはどれですか',
          type: 'single',
          options: [
            '開発案件はあるがエンジニアが足りない',
            '作りたいシステムがある',
            '紙と手作業が多い',
            '既存システムにAIを入れたい',
            '何から手をつけるか決まっていない',
          ],
        },
        {
          id: 'q2',
          label: '社内の開発体制はどうなっていますか',
          type: 'single',
          options: ['エンジニア5名以上', '1〜4名', 'いない・外注のみ', 'わからない'],
        },
        {
          id: 'q3',
          label: '感じていることはどれが近いですか',
          type: 'multi',
          options: [
            '採用が追いつかない',
            '開発が遅れている',
            '業務が属人化している',
            'AI活用の進め方がわからない',
            '既存システムが古い',
          ],
        },
        {
          id: 'q4',
          label: '検討している時期はいつ頃ですか',
          type: 'single',
          options: ['今すぐ', '3ヶ月以内', '半年以内', '情報収集の段階'],
        },
      ],
      profileFields: BASE_PROFILE,
    },
  },

  {
    id: 'newgrad',
    slug: 'newgrad',
    company: 'PEP lab',
    serviceName: 'PEP lab',
    tagline: '学生との関係づくりから、採用まで',
    description:
      '学生を集めるだけで終わらせず、企業のファンを育てることで新卒採用につなげる採用支援サービス。継続的な接点をつくり、自然応募・紹介・採用へとつなげます。',
    theme: { primary: '#E85A6E', accent: '#F2919F', bg: '#FFF7F8', text: '#3A1620' },
    problems: [
      { title: '学生が集まりにくい', detail: '毎年ゼロから母集団形成が必要' },
      { title: '接点が一過性', detail: '説明会やスカウトで終わりやすい' },
      { title: '企業理解が浅い', detail: '共感や志望度が高まりにくい' },
      { title: '採用担当が手薄', detail: '兼任で継続運用まで回らない' },
    ],
    features: [
      { title: '学生コミュニティ構築', detail: '学生との継続接点をつくる' },
      { title: '関係構築・エンゲージメント設計', detail: '継続的な交流でファン化を促進' },
      { title: 'PEPコミュニティドリブン採用™', detail: 'ファン化→自然応募・紹介→採用を設計' },
      { title: 'カスタム人事サービス', detail: '媒体選定・応募対応・面接調整・内定後フォローまで' },
      { title: '人材紹介', detail: '企業文化との相性も重視して紹介' },
      { title: '採用施策実行支援', detail: 'SNS運用・イベント企画・スカウト送信などに対応' },
    ],
    strengths: [
      { title: 'ファン化起点', detail: '応募前から企業理解と共感を育てる' },
      { title: '戦略から実務まで一貫支援', detail: '採用戦略だけでなく運用実務まで伴走' },
      { title: '柔軟で導入しやすい', detail: '正社員採用より低コスト・短期間で人事機能を補完' },
      { title: 'ミスマッチを抑えやすい', detail: '継続接点により相性の良い採用へ' },
    ],
    stats: [
      {
        label: 'サービス',
        value: '3',
        unit: '種類',
        note: 'コミュニティドリブン採用™・カスタム人事サービス・人材紹介',
      },
      {
        label: '料金',
        value: '12',
        unit: '万円〜（月額）',
        note: '採用専任がいない法人向けライトプラン',
      },
      { label: 'プラン', value: '12/18/22万', unit: '', note: 'ライト・ミドル・プロ' },
    ],
    links: [{ label: 'サービスHP', url: 'https://peplab.jp/' }],
    survey: {
      questions: [
        {
          id: 'q1',
          label: '新卒採用の状況はどれが近いですか',
          type: 'single',
          options: ['毎年やっている', '今年から始める', '以前やって中断している', '検討中'],
        },
        {
          id: 'q2',
          label: '年間の採用予定人数はどのくらいですか',
          type: 'single',
          options: ['1〜2名', '3〜5名', '6〜10名', '11名以上', '未定'],
        },
        {
          id: 'q3',
          label: '感じていることはどれが近いですか',
          type: 'multi',
          options: [
            '学生が集まらない',
            '説明会やスカウトで接点が切れる',
            '志望度が上がらない',
            '内定辞退が多い',
            '採用担当が兼任で手が回らない',
          ],
        },
        {
          id: 'q4',
          label: 'いま使っている採用手法はどれですか',
          type: 'multi',
          options: ['求人媒体', 'スカウト', '人材紹介', 'インターン', 'リファラル', '特になし'],
        },
      ],
      profileFields: BASE_PROFILE,
    },
  },

  {
    id: 'wordpress',
    slug: 'wordpress',
    company: '株式会社DPパートナーズ',
    serviceName: 'サイト引越し屋さん',
    tagline: 'WordPressの移転・保守・復旧を、まとめて',
    description:
      '「Webサイトを資産に変える」を掲げ、WordPressサイトを作る・育てる・守るWebの専門企業。引越しから保守、セキュリティ、障害時の復旧まで一括対応します。',
    theme: { primary: '#1B5AAE', accent: '#4E8FD6', bg: '#F6FAFF', text: '#15263D' },
    problems: [
      { title: 'サーバー移転が不安', detail: '移行時の事故やSEO影響が心配' },
      { title: '保守管理が後回し', detail: '本業が忙しく更新・点検に手が回らない' },
      { title: '障害時の復旧が怖い', detail: '不具合発生時にすぐ相談できない' },
      { title: 'セキュリティ対策が不十分', detail: '攻撃やトラブルへの備えに不安' },
    ],
    features: [
      { title: 'WordPress引越し', detail: 'サーバー移転・ドメイン変更を安全に支援' },
      { title: '他システムから移行', detail: 'Wix・Jimdo・HTMLなどからWordPress移行' },
      { title: '移転オプション', detail: 'ドメイン移管・メール移行にも対応' },
      { title: '保守管理サービス', detail: '日々の保守・点検・不具合対応を支援' },
      { title: 'バックアップ・監視', detail: 'AWS環境バックアップと24時間365日サイト監視' },
      { title: '復旧・改善提案', detail: '障害復旧と根本改善までサポート' },
    ],
    strengths: [
      { title: '圧倒的な実績', detail: '2017年1月サービス開始、累計3,500件超' },
      { title: '万全の補償体制', detail: '損害賠償保険 最大1億円までカバー' },
      { title: '提案力と対話力', detail: 'Face to Faceの接客と根本解決の提案' },
      { title: '柔軟な対応', detail: '納期相談・夜間休日の相談にも柔軟' },
    ],
    stats: [
      { label: '対応実績', value: '3,500', unit: '件超（累計）' },
      { label: '公開事例・お客様の声', value: '300', unit: '件超' },
      {
        label: '保守体制',
        value: '24時間365日',
        unit: '',
        note: 'サイト監視・AWS定期バックアップ・復旧対応',
      },
    ],
    links: [
      { label: '会社HP', url: 'https://dp-partners.co.jp/' },
      { label: 'サイト引越し屋さん', url: 'https://site-hikkoshi.com/' },
    ],
    survey: {
      questions: [
        {
          id: 'q1',
          label: '今のサイトはどれで作られていますか',
          type: 'single',
          options: ['WordPress', 'Wix・Jimdoなど', 'HTML直書き', 'わからない'],
        },
        {
          id: 'q2',
          label: '困っていることはどれが近いですか',
          type: 'multi',
          options: [
            'サーバーを移したい',
            '更新や保守が止まっている',
            '障害時にすぐ相談できない',
            'セキュリティが不安',
            '表示が遅い',
          ],
        },
        {
          id: 'q3',
          label: 'いまの保守はどうしていますか',
          type: 'single',
          options: ['社内で対応', '制作会社に依頼', '何かあった時だけ', '誰も見ていない'],
        },
        {
          id: 'q4',
          label: '管理しているサイトはいくつありますか',
          type: 'single',
          options: ['1つ', '2〜5', '6〜10', '11以上'],
        },
      ],
      profileFields: BASE_PROFILE,
    },
  },

  {
    id: 'crm',
    slug: 'crm',
    company: '株式会社エボルグ',
    serviceName: 'Empro',
    tagline: '集める、つなぐ、決めるをひとつに',
    description:
      '人材紹介会社の採用決定を最大化する、人材紹介特化型のワンストップCRM/MAツール。求職者・求人・選考進捗の一元管理から、AIマッチング、追客の自動化まで対応します。',
    theme: { primary: '#147F6E', accent: '#34A392', bg: '#F5FBF9', text: '#10322C' },
    problems: [
      { title: '情報が分散', detail: 'スプレッドシート管理が煩雑' },
      { title: '追客が属人化', detail: '担当者次第で対応品質に差が出る' },
      { title: '休眠求職者を活かせない', detail: '掘り起こしやレコメンドが手作業' },
      { title: 'KPIが見えにくい', detail: '面談数・紹介数・成約率の把握に時間がかかる' },
    ],
    features: [
      { title: 'AIマッチング機能', detail: '経歴・スキル・住所などから自動マッチング' },
      { title: 'AIワークフロー機能', detail: '求人票や録画から情報を自動抽出・入力' },
      { title: '求人・求職者管理', detail: '求人・求職者・選考進捗を一元管理' },
      { title: 'コミュニケーション機能', detail: 'LINE・メール連携で連絡を一元化' },
      { title: 'MA機能', detail: '自動追客・シナリオ配信で集客と掘り起こしを支援' },
      { title: 'ダッシュボード', detail: '主要KPIをリアルタイムで可視化' },
    ],
    strengths: [
      { title: '人材紹介特化', detail: '紹介事業を伸ばすことに特化' },
      { title: '売上向上にコミット', detail: '単なる管理ではなく成果改善を支援' },
      { title: 'AIと人の伴走支援', detail: '専任コンサルタントが定例で支援' },
      { title: '導入負担が少ない', detail: '既存CRM・スプレッドシートから移行しやすい' },
    ],
    stats: [
      {
        label: 'AIマッチング精度',
        value: '+35',
        unit: '%',
        note: '手動より向上（一部β版機能を含む／数値は当社調べ）',
      },
      {
        label: 'データ入力時間',
        value: '-80',
        unit: '%',
        note: '平均削減（一部β版機能を含む／数値は当社調べ）',
      },
      { label: 'サポート体制', value: '専任コンサル', unit: '', note: '定例支援あり' },
    ],
    links: [
      { label: '会社HP', url: 'https://evorg.co.jp/' },
      { label: 'Empro', url: 'https://getempro.jp/' },
    ],
    survey: {
      questions: [
        {
          id: 'q1',
          label: '人材紹介事業の位置づけはどれですか',
          type: 'single',
          options: ['メイン事業', '一部として実施', 'これから始める', '検討中'],
        },
        {
          id: 'q2',
          label: 'いまの管理方法はどれですか',
          type: 'single',
          options: ['スプレッドシート・Excel', '他社CRM', '自社システム', '紙とメール'],
        },
        {
          id: 'q3',
          label: '感じていることはどれが近いですか',
          type: 'multi',
          options: [
            '追客が属人化して漏れる',
            '情報が分散している',
            '休眠求職者を掘り起こせない',
            'KPIが見えない',
            '入力の手間が多い',
          ],
        },
        {
          id: 'q4',
          label: '事業に関わっているのは何名くらいですか',
          type: 'single',
          options: ['1〜3名', '4〜10名', '11〜30名', '31名以上'],
        },
      ],
      profileFields: BASE_PROFILE,
    },
  },
];

export const getService = (id: string): Service => {
  const found = services.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown service id: ${id}`);
  return found;
};
