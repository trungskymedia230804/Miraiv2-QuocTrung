// modules/commands/baucua.js
module.exports.config = {
  name: "baucua",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "TrungMedia + GPT5",
  description: "Bầu cua tôm cá (đặt 1 con + số tiền)",
  commandCategory: "Game free",
  usages: "baucua <bau|cua|tom|ca|nai|ga> <số tiền|all>",
  cooldowns: 5
};

const ANIMALS = [
  { key: "bau",  label: "Bầu", emoji: "🎰" },
  { key: "cua",  label: "Cua",  emoji: "🦀" },
  { key: "tom",  label: "Tôm",  emoji: "🦐" },
  { key: "ca",   label: "Cá",   emoji: "🐟" },
  { key: "nai",  label: "Nai",  emoji: "🦌" },
  { key: "ga",   label: "Gà",   emoji: "🐔" }
];

function asKey(text="") {
  // bỏ dấu và hạ chữ để dễ gõ
  return text
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/(^|\s)to?m(\s|$)/, "$1tom$2"); // to↔tom an toàn
}
function moneyStr(n){ return Number(n).toLocaleString("en-US"); }

module.exports.run = async ({ api, event, args, Currencies, Users }) => {
  const { threadID, messageID, senderID } = event;

  // ----- đọc input
  if (args.length < 2)
    return api.sendMessage(
      "Cách dùng: /baucua <bau|cua|tom|ca|nai|ga> <số tiền|all>",
      threadID, messageID
    );

  const pickKey = asKey(args[0]);
  const pick = ANIMALS.find(a => a.key === pickKey);
  if (!pick)
    return api.sendMessage(
      "Con hợp lệ: bau, cua, tom, ca, nai, ga.",
      threadID, messageID
    );

  // ----- tiền
  const wallet = await Currencies.getData(senderID);
  const balance = Number(wallet?.money || 0);
  const bet = args[1] === "all" ? balance : parseInt(args[1], 10);

  if (!Number.isFinite(bet) || bet <= 0)
    return api.sendMessage("Số tiền không hợp lệ.", threadID, messageID);
  if (bet < 100)
    return api.sendMessage("Mức cược tối thiểu là 100$.", threadID, messageID);
  if (bet > balance)
    return api.sendMessage("Bạn không đủ tiền để cược.", threadID, messageID);

  // ----- gieo 3 xúc xắc bầu cua
  const roll = [];
  for (let i = 0; i < 3; i++) {
    const r = ANIMALS[Math.floor(Math.random()*ANIMALS.length)];
    roll.push(r);
  }

  // ----- tính kết quả
  const matches = roll.filter(r => r.key === pick.key).length;
  let delta = 0, result = "Thua";

  if (matches > 0) {
    delta = bet * matches;                  // trả thưởng 1x / 2x / 3x
    await Currencies.increaseMoney(senderID, delta);
    result = `Thắng (trúng ${matches} lần)`;
  } else {
    delta = -bet;
    await Currencies.decreaseMoney(senderID, bet);
  }

  // ----- hiển thị
  const name = await Users.getNameUser(senderID);
  const faces = roll.map(r => `${r.emoji} ${r.label}`).join("  |  ");

  const msg =
    `🎲  BẦU CUA TÔM CÁ\n` +
    `• Người chơi: ${name}\n` +
    `• Đặt: ${pick.emoji} ${pick.label}\n` +
    `• Tiền cược: ${moneyStr(bet)}$\n` +
    `• Kết quả: ${faces}\n` +
    `• Tính tiền: ${result}  (${delta > 0 ? "+" : ""}${moneyStr(delta)}$)\n`;

  return api.sendMessage(msg, threadID, messageID);
};
