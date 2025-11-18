router.get('/my-payments', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const paymentTx = await db.query(
      `
      SELECT id, type, amount, created_at
      FROM transactions
      WHERE user_id = $1 AND LOWER(type) LIKE '%payment%'
      ORDER BY created_at DESC
      `,
      [userId]
    );

    res.json(paymentTx.rows);
  } catch (err) {
    console.error("❌ Payment history error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});
