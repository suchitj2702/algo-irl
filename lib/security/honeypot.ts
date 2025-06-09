export function generateHoneypotField(): string {
  // Generate a random field name that bots might fill
  const names = ['username', 'email', 'phone', 'website', 'url', 'name'];
  return names[Math.floor(Math.random() * names.length)];
}

export function checkHoneypot(data: Record<string, unknown>, honeypotField: string): boolean {
  // If honeypot field is filled, it's likely a bot
  return !data[honeypotField] || data[honeypotField] === '';
} 