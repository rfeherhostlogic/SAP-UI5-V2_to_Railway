const bcrypt = require("bcryptjs");

async function main() {
  const password = process.argv[2] || "";
  const rounds = Number(process.argv[3] || 12);

  if (!password) {
    console.error("Usage: npm run hash:password -- \"your-password\" [rounds]");
    process.exit(1);
  }

  if (!Number.isFinite(rounds) || rounds < 8 || rounds > 15) {
    console.error("Invalid bcrypt rounds. Use a number between 8 and 15.");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, rounds);
  console.log(hash);
}

main().catch(function(err) {
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
});
