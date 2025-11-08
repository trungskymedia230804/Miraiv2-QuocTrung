const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
  name: "gái",
  version: "1.0.2",
  hasPermssion: 0,
  credits: "TrungMedia + GPT5",
  description: "Random ảnh gái, trừ 5$",
  commandCategory: "fun",
  usages: "",
  cooldowns: 5
};

const links = [
  "https://files.catbox.moe/m4gjwk.jpg",
  "https://files.catbox.moe/0ov04q.jpg",
  "https://files.catbox.moe/3oigqr.jpg",
  "https://files.catbox.moe/4khsui.jpg",
  "https://files.catbox.moe/6g85k9.jpg",
  "https://files.catbox.moe/ibys4e.jpg",
  "https://files.catbox.moe/v0gyls.jpg",
  "https://files.catbox.moe/8jfztp.jpg",
  "https://files.catbox.moe/z1z59f.jpg",
  "https://files.catbox.moe/4t1utt.jpg",
  "https://files.catbox.moe/dq3gfw.jpg",
  "https://files.catbox.moe/s09o7h.jpg",
  "https://files.catbox.moe/ey57yw.jpg",
  "https://files.catbox.moe/84vadg.jpg",
  "https://files.catbox.moe/07m8ag.jpg",
  "https://files.catbox.moe/0ojkco.jpg",
  "https://files.catbox.moe/nj3shc.jpg",
  "https://files.catbox.moe/b7wxm6.jpg",
  "https://files.catbox.moe/8917c9.jpg",
  "https://files.catbox.moe/4bt60e.jpg",
  "https://files.catbox.moe/mfh6em.jpg"
  
];

module.exports.run = async ({ api, event, Currencies }) => {
  const { threadID, messageID, senderID } = event;

  try {
    const data = await Currencies.getData(senderID);
    const money = (data && typeof data.money === "number") ? data.money : 0;

    if (money < 5) {
      return api.sendMessage("⚠️ Bạn không đủ tiền (5$) để xem ảnh gái đâu 🥺", threadID, messageID);
    }

    await Currencies.decreaseMoney(senderID, 5);

    // random ảnh
    const url = links[Math.floor(Math.random() * links.length)];

    // tải về tạm
    const filePath = path.join(__dirname, "tmp_gai.jpg");
    const res = await axios.get(url, { responseType: "arraybuffer" });
    fs.writeFileSync(filePath, Buffer.from(res.data, "binary"));

    // gửi ảnh
    await api.sendMessage(
      {
        body: "💖 Ảnh gái random nè (đã trừ 5$)!",
        attachment: fs.createReadStream(filePath)
      },
      threadID,
      messageID
    );

    // xóa file tạm
    fs.unlinkSync(filePath);

  } catch (err) {
    console.error(err);
    try { await Currencies.increaseMoney(senderID, 5); } catch {}
    return api.sendMessage("❌ Lỗi tải ảnh hoặc hệ thống. Đã hoàn 5$ nhé.", threadID, messageID);
  }
};
