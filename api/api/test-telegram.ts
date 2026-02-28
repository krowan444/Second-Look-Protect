export default async function handler(req: any, res: any) {
  const key = req.query.key;

  if (key !== process.env.ADMIN_PING_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return res.status(500).json({ error: "Missing env vars" });
  }

  const message = `🚨 Second Look Protect Alert System Online
Time: ${new Date().toISOString()}`;

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
    }),
  });

  const data = await response.json();

  return res.status(200).json({ success: true, telegram: data });
}
