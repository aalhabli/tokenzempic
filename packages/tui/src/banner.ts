const BIG = `
████████╗ ██████╗ ██╗  ██╗███████╗███╗   ██╗███████╗███████╗███╗   ███╗██████╗ ██╗ ██████╗
╚══██╔══╝██╔═══██╗██║ ██╔╝██╔════╝████╗  ██║╚══███╔╝██╔════╝████╗ ████║██╔══██╗██║██╔════╝
   ██║   ██║   ██║█████╔╝ █████╗  ██╔██╗ ██║  ███╔╝ █████╗  ██╔████╔██║██████╔╝██║██║
   ██║   ██║   ██║██╔═██╗ ██╔══╝  ██║╚██╗██║ ███╔╝  ██╔══╝  ██║╚██╔╝██║██╔═══╝ ██║██║
   ██║   ╚██████╔╝██║  ██╗███████╗██║ ╚████║███████╗███████╗██║ ╚═╝ ██║██║     ██║╚██████╗
   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚══════╝╚══════╝╚═╝     ╚═╝╚═╝     ╚═╝ ╚═════╝
`.trim();

const ART_WIDTH = 90;
const TAGLINE = 'put your agent on a zero token diet';

const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

/**
 * The startup banner. Falls back to a plain one-liner when the terminal is
 * too narrow for the big art or when not a TTY.
 */
export function renderBanner(
  width: number = process.stdout.columns ?? 80,
  color: boolean = process.stdout.isTTY ?? false,
): string {
  if (width < ART_WIDTH) {
    return color ? `${CYAN}tokenzempic${RESET} ${DIM}— ${TAGLINE}${RESET}` : `tokenzempic — ${TAGLINE}`;
  }
  const art = color ? `${CYAN}${BIG}${RESET}` : BIG;
  const tag = color ? `${DIM}${TAGLINE}${RESET}` : TAGLINE;
  return `${art}\n${' '.repeat(Math.max(0, ART_WIDTH - TAGLINE.length))}${tag}`;
}
