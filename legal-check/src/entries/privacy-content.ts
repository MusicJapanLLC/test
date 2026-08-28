import { site } from '../data/site';
import { el, externalAttrs } from '../lib/dom';

type Block = { heading: string; body: (Node | string)[] };

const p = (text: string) => el('p', { text });
const list = (items: string[]) => el('ul', {}, items.map((t) => el('li', { text: t })));
const link = (label: string, url: string) => el('a', { href: url, ...externalAttrs, text: label });

const blocks: Block[] = [
  {
    heading: '1. 取得する個人情報',
    body: [
      p('当社は、本サイト上のアンケートおよびお問い合わせを通じて、次の情報を取得します。'),
      list([
        '会社名',
        'ご担当者のお名前',
        'メールアドレス',
        '電話番号',
        '役職',
        '資本金',
        '従業員数',
        'アンケートへのご回答内容（ご選択いただいた項目、ご記入いただいたひとこと、ご希望の連絡方法）',
      ]),
      p('サービスによって、お伺いする項目は異なります。実際にお伺いする項目は、各アンケート画面に表示されるものに限られます。'),
    ],
  },
  {
    heading: '2. 利用目的',
    body: [
      p('取得した情報は、次の目的の範囲内で利用します。'),
      list([
        'ご関心をお持ちいただいたサービスのご案内、ご連絡',
        '提携先事業者への取次ぎ',
        'サービス改善のための統計的な分析（個人を特定しない形で行います）',
      ]),
    ],
  },
  {
    heading: '3. 第三者提供について',
    body: [
      p(
        'お客様が関心を示されたサービスの提供事業者へ、ご連絡のために必要な範囲で提供する場合があります。',
      ),
      p(
        '提供する内容は、会社名・ご担当者名・メールアドレス・電話番号・役職・アンケートへのご回答内容など、ご連絡と検討に必要な範囲に限られます。',
      ),
      p(
        '上記のほか、法令に基づく場合を除き、あらかじめご本人の同意を得ることなく第三者へ提供することはありません。',
      ),
    ],
  },
  {
    heading: '4. Cookie・アクセス解析について',
    body: [
      p(
        '本サイトでは、利用状況の把握と広告効果の測定のため、Cookie等を利用した次のツールを使用する場合があります。',
      ),
      list([
        'Google アナリティクス 4（Google LLC）',
        'Meta ピクセル（Meta Platforms, Inc.）',
      ]),
      p(
        'いずれも個人を特定する情報は含みません。取得を希望されない場合は、次の方法で停止できます。',
      ),
      el('ul', {}, [
        el('li', {}, [
          'Google アナリティクス: ',
          link(
            'Google アナリティクス オプトアウト アドオン',
            'https://tools.google.com/dlpage/gaoptout?hl=ja',
          ),
          ' をご利用ください。',
        ]),
        el('li', {}, [
          'Meta ピクセル: ',
          link('Facebook の広告設定', 'https://www.facebook.com/adpreferences/ad_settings'),
          ' から配信設定を変更できます。',
        ]),
        el('li', {}, ['ブラウザの設定から、Cookie の受け入れを拒否することもできます。']),
      ]),
    ],
  },
  {
    heading: '5. 安全管理措置',
    body: [
      p(
        '取得した情報は、アクセス権限を限定した環境で管理し、担当者以外が閲覧できないようにしています。',
      ),
      p(
        '通信は暗号化（TLS）した経路で行い、保管先のサービスについても、提供元が定める安全管理の仕組みに従って運用します。',
      ),
      p('不要となった情報は、利用目的の達成後、速やかに削除します。'),
    ],
  },
  {
    heading: '6. 開示・訂正・削除のご請求',
    body: [
      p(
        'ご自身の情報について、開示・訂正・追加・削除・利用停止をご希望の場合は、下記の窓口までご連絡ください。ご本人であることを確認のうえ、法令に従って速やかに対応します。',
      ),
      el('dl', {}, [
        el('dt', { text: '事業者' }),
        el('dd', { text: site.operator.name }),
        el('dt', { text: '代表者' }),
        el('dd', { text: site.operator.representative }),
        el('dt', { text: '所在地' }),
        el('dd', { text: site.operator.address }),
        el('dt', { text: 'メール' }),
        el('dd', {}, [el('a', { href: `mailto:${site.operator.email}`, text: site.operator.email })]),
        el('dt', { text: '電話' }),
        el('dd', {}, [el('a', { href: `tel:${site.operator.tel.replace(/-/g, '')}`, text: site.operator.tel })]),
      ]),
    ],
  },
  {
    heading: '7. 本ポリシーの改定について',
    body: [
      p(
        '法令の改正や運用の変更にあわせて、本ポリシーの内容を見直すことがあります。変更した場合は、本ページに改定後の内容と改定日を掲載します。',
      ),
    ],
  },
];

/** プライバシーポリシー本文 */
export function renderPrivacy(app: HTMLElement): void {
  app.append(
    el('header', { class: 'doc__header' }, [
      el('div', { class: 'wrap' }, [
        el('p', { class: 'section__label', text: 'Privacy Policy' }),
        el('h1', { class: 'doc__title', text: 'プライバシーポリシー' }),
        el('p', {
          class: 'doc__meta',
          text: `${site.operator.name}　制定日 ${site.established}`,
        }),
      ]),
    ]),
    el('div', { class: 'doc__body' }, [
      el(
        'div',
        { class: 'wrap' },
        [
          el('p', {
            text: `${site.operator.name}（以下「当社」）は、本サイト「${site.nameJa}」を通じてお預かりする個人情報を、次のとおり取り扱います。`,
          }),
          ...blocks.map((block) =>
            el('section', {}, [el('h2', { text: block.heading }), ...block.body]),
          ),
        ],
      ),
    ]),
  );
}
