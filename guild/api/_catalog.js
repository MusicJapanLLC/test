// 販売する品の一覧（値段と中身の正本はサーバー側。ゲームは id だけを送る）
//   kind: cry=魔晶石 / once=1回だけ / pass=定期便 / run=周回ごとに1回 / perm=ずっと続く効果
//   price は税込の円
module.exports = [
  { id: 'cry60', kind: 'cry', name: '魔晶石 60', price: 120, grant: { cry: 60 }, desc: '魔晶石 60個' },
  { id: 'cry330', kind: 'cry', name: '魔晶石 330', price: 600, grant: { cry: 330 }, desc: '魔晶石 300個＋おまけ30個', bonus: '+10%' },
  { id: 'cry1100', kind: 'cry', name: '魔晶石 1,100', price: 1800, grant: { cry: 1100 }, desc: '魔晶石 900個＋おまけ200個', bonus: '+22%' },
  { id: 'cry2400', kind: 'cry', name: '魔晶石 2,400', price: 3600, grant: { cry: 2400 }, desc: '魔晶石 1,800個＋おまけ600個', bonus: '+33%' },
  { id: 'cry7000', kind: 'cry', name: '魔晶石 7,000', price: 9800, grant: { cry: 7000 }, desc: '魔晶石 5,000個＋おまけ2,000個', bonus: '+40%' },
  { id: 'starter', kind: 'once', name: 'はじめての灯火パック', price: 370, grant: { cry: 300, book: 1, auto180: 3, hg3: 2 }, desc: '魔晶石300・閃きの書・おまかせ札（3時間）×3・神速の砂時計×2。1回だけ' },
  { id: 'pass30', kind: 'pass', name: '灯火の定期便（30日）', price: 480, grant: { cry: 150 }, days: 30, daily: { cry: 40, auto30: 1 }, desc: 'すぐに魔晶石150。30日間、毎日 魔晶石40とおまかせ札（30分）。期間中は留守番の上限 +2時間' },
  { id: 'runpack', kind: 'run', name: '周回応援パック', price: 980, grant: { cry: 400, hg3: 3, auto180: 3, expbook: 10, key: 3 }, desc: '魔晶石400・神速の砂時計×3・おまかせ札（3時間）×3・経験の書×10・宝箱の鍵×3。周回ごとに1回' },
  { id: 'starbook', kind: 'perm', name: '星詠みの書', price: 1200, grant: { cry: 200 }, desc: '再建で手に入る灯火の星が、ずっと +20%。魔晶石200つき。1回だけ' },
];
