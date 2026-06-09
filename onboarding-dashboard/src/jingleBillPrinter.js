// Generates a printable page of Jingle Bills — Christmas Air brand

export function printJingleBills({ employeeName = '', managerName = '' } = {}) {

  // The Christmas Air logo recreated as inline SVG (matches the uploaded logo exactly)
  const LOGO_SVG = `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
    <!-- Olive/gold sunburst ellipse behind badge -->
    <ellipse cx="100" cy="80" rx="70" ry="42" fill="#9a8a3a" opacity="0.9"/>
    <!-- Sunburst rays -->
    <g opacity="0.6" stroke="#7a6a2a" stroke-width="1">
      <line x1="100" y1="80" x2="30" y2="75"/><line x1="100" y1="80" x2="32" y2="65"/>
      <line x1="100" y1="80" x2="170" y2="75"/><line x1="100" y1="80" x2="168" y2="65"/>
      <line x1="100" y1="80" x2="32" y2="90"/><line x1="100" y1="80" x2="168" y2="90"/>
    </g>
    <!-- Main badge shape: top green panel -->
    <path d="M28,18 Q100,8 172,18 L168,52 Q100,44 32,52 Z" fill="#4e7c5f"/>
    <!-- Bottom green panel -->
    <path d="M32,108 Q100,116 168,108 L172,142 Q100,152 28,142 Z" fill="#4e7c5f"/>
    <!-- Side wings top -->
    <path d="M28,18 L8,30 L10,52 L32,52 Z" fill="#4e7c5f"/>
    <path d="M172,18 L192,30 L190,52 L168,52 Z" fill="#4e7c5f"/>
    <!-- Side wings bottom -->
    <path d="M32,108 L10,108 L8,130 L28,142 Z" fill="#4e7c5f"/>
    <path d="M168,108 L190,108 L192,130 L172,142 Z" fill="#4e7c5f"/>
    <!-- Cream ribbon / banner across middle -->
    <path d="M14,55 Q100,47 186,55 L186,105 Q100,113 14,105 Z" fill="#f0ead8"/>
    <!-- Cream ribbon edge lines -->
    <path d="M14,55 Q100,47 186,55" fill="none" stroke="#c4b89a" stroke-width="1"/>
    <path d="M14,105 Q100,113 186,105" fill="none" stroke="#c4b89a" stroke-width="1"/>
    <!-- Top green text: AIR CONDITIONING -->
    <text x="100" y="38" text-anchor="middle" font-family="'Arial Black',sans-serif" font-size="12" font-weight="900" fill="#f0ead8" letter-spacing="2">AIR CONDITIONING</text>
    <!-- Script: Christmas -->
    <text x="100" y="92" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="28" font-weight="700" font-style="italic" fill="#8b2635">Christmas</text>
    <!-- Bottom green text: AND PLUMBING with arrows -->
    <text x="100" y="130" text-anchor="middle" font-family="'Arial Black',sans-serif" font-size="11" font-weight="900" fill="#f0ead8" letter-spacing="2">AND PLUMBING</text>
    <!-- Arrow decorations -->
    <text x="38" y="130" text-anchor="middle" font-family="serif" font-size="10" fill="#f0ead8">←</text>
    <text x="162" y="130" text-anchor="middle" font-family="serif" font-size="10" fill="#f0ead8">→</text>
    <!-- Outer cream border of badge -->
    <path d="M28,18 Q100,8 172,18 L192,30 L190,52 L186,55 L186,105 L190,108 L192,130 L172,142 Q100,152 28,142 L8,130 L10,108 L14,105 L14,55 L10,52 L8,30 Z" fill="none" stroke="#f0ead8" stroke-width="3.5"/>
    <path d="M28,18 Q100,8 172,18 L192,30 L190,52 L186,55 L186,105 L190,108 L192,130 L172,142 Q100,152 28,142 L8,130 L10,108 L14,105 L14,55 L10,52 L8,30 Z" fill="none" stroke="#c4b89a" stroke-width="1.2" stroke-dasharray="none" opacity="0.5"/>
  </svg>`;

  // Generate 8 unique serials starting with CAJB5625
  const serials = Array.from({length:8}, (_,i) => 'CAJB5625' + String(i+1).padStart(2,'0'));

  const EMPLOYEE = employeeName;
  const MANAGER  = managerName;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Jingle Bills — Christmas Air</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Oswald:wght@500;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#e8e4dc;font-family:'Crimson Text',Georgia,serif;padding:0}
  @media print{
    body{background:white}
    .no-print{display:none!important}
    @page{margin:0.35in;size:letter}
    .grid{gap:0.18in}
  }
  .no-print{
    text-align:center;padding:16px;display:flex;gap:12px;align-items:center;
    justify-content:center;background:#2f5240;
  }
  .print-btn{
    padding:10px 28px;background:#9a8a3a;color:#fff;border:2px solid #f0ead8;
    border-radius:8px;font-family:'Oswald',sans-serif;font-size:14px;font-weight:700;
    letter-spacing:.12em;cursor:pointer;text-transform:uppercase;
  }
  .print-btn:hover{background:#7a6a2a}
  .info{font-family:'Crimson Text',Georgia,serif;font-size:13px;color:rgba(240,234,216,.7)}
  .grid{
    width:7.4in;margin:0.2in auto;
    display:grid;grid-template-columns:1fr 1fr;gap:0.2in;
  }

  /* ── Single bill ── */
  .bill{
    width:3.5in;height:1.65in;
    position:relative;border-radius:6px;overflow:hidden;
    background:#f5f0e0;
    border:3.5px solid #2f5240;
    box-shadow:0 3px 12px rgba(60,40,10,.3);
  }
  /* Outer maroon frame inset */
  .bill::before{
    content:'';position:absolute;inset:5px;
    border:1.5px solid #8b2635;border-radius:3px;pointer-events:none;z-index:10;
  }
  /* Fine inner tan line */
  .bill::after{
    content:'';position:absolute;inset:9px;
    border:0.75px solid #c4b89a;border-radius:2px;pointer-events:none;z-index:10;
  }

  /* Guilloche background SVG */
  .guilloche{
    position:absolute;inset:0;width:100%;height:100%;
    opacity:0.055;pointer-events:none;z-index:1;
  }

  /* Corner ovals */
  .corner{
    position:absolute;width:36px;height:44px;border-radius:50%;
    background:#2f5240;border:1.5px solid #8b2635;
    display:flex;align-items:center;justify-content:center;
    font-family:'Playfair Display',Georgia,serif;
    font-size:17px;font-weight:900;color:#f0ead8;z-index:5;
  }
  .tl{top:-3px;left:-3px}
  .tr{top:-3px;right:-3px}
  .bl{bottom:-3px;left:-3px}
  .br{bottom:-3px;right:-3px}

  /* Serial — top center, clear of corners */
  .serial-top{
    position:absolute;top:7px;left:0;right:0;
    text-align:center;z-index:6;
    font-family:'Oswald',sans-serif;font-size:6px;font-weight:700;
    color:#2f5240;letter-spacing:.14em;
  }

  /* Logo — left side */
  .logo-wrap{
    position:absolute;left:13px;top:50%;transform:translateY(-50%);
    width:62px;height:50px;z-index:5;
  }

  /* Center text block */
  .bill-center{
    position:absolute;left:82px;right:82px;top:0;bottom:0;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    z-index:5;gap:0;
  }
  .denom-label{
    font-family:'Oswald',sans-serif;font-size:6px;font-weight:500;
    color:#9a8a3a;letter-spacing:.18em;text-transform:uppercase;margin-bottom:1px;
  }
  .jingle-word{
    font-family:'Oswald',sans-serif;font-size:11px;font-weight:700;
    color:#2f5240;letter-spacing:.2em;text-transform:uppercase;line-height:1;
  }
  .bills-word{
    font-family:'Playfair Display',Georgia,serif;font-size:19px;font-weight:900;
    font-style:italic;color:#8b2635;line-height:1;margin-top:-1px;
  }
  .divider{
    width:70%;height:0.75px;
    background:linear-gradient(90deg,transparent,#c4b89a 30%,#c4b89a 70%,transparent);
    margin:3px 0 2px;
  }
  .company-name{
    font-family:'Oswald',sans-serif;font-size:5.5px;font-weight:500;
    color:#6b8a7a;letter-spacing:.14em;text-transform:uppercase;
  }

  /* Right decorative seal */
  .seal{
    position:absolute;right:14px;top:50%;transform:translateY(-50%);
    width:36px;height:36px;border-radius:50%;
    border:1.5px dashed #8b2635;background:rgba(139,38,53,.06);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    z-index:5;
  }
  .seal-c{
    font-family:'Playfair Display',Georgia,serif;font-size:12px;
    font-weight:900;font-style:italic;color:#8b2635;line-height:1;
  }
  .seal-text{
    font-family:'Oswald',sans-serif;font-size:4.5px;font-weight:700;
    color:#8b2635;letter-spacing:.08em;text-transform:uppercase;
    text-align:center;line-height:1.2;
  }

  /* Signature area — bottom strip */
  .sig-strip{
    position:absolute;bottom:12px;left:82px;right:82px;
    display:flex;gap:6px;align-items:flex-end;z-index:6;
  }
  .sig-block{flex:1;display:flex;flex-direction:column;align-items:center;gap:0}
  .sig-value{
    font-family:'Playfair Display',Georgia,serif;font-style:italic;
    font-size:7.5px;color:#2f5240;max-width:100%;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    padding:0 3px;text-align:center;line-height:1.2;min-height:9px;
  }
  .sig-line{width:100%;height:0.75px;background:#8b2635;margin:1px 0}
  .sig-label{
    font-family:'Oswald',sans-serif;font-size:5px;font-weight:500;
    color:#9a8a3a;letter-spacing:.1em;text-transform:uppercase;
  }
  .sig-mid{width:1px;height:18px;background:#c4b89a;flex-shrink:0;margin:0 2px}
</style>
</head>
<body>

<div class="no-print">
  <button class="print-btn" onclick="window.print()">🖨️ Print Jingle Bills</button>
  <span class="info">8 bills per page &nbsp;·&nbsp; Cut along edges &nbsp;·&nbsp; Hand out to employees</span>
</div>

<div class="grid" id="grid"></div>

<script>
const LOGO = ${JSON.stringify(LOGO_SVG)};
const EMP  = ${JSON.stringify(EMPLOYEE)};
const MGR  = ${JSON.stringify(MANAGER)};
const SERIALS = ${JSON.stringify(serials)};

function bill(serial) {
  return '<div class="bill">'

    // Guilloche
    + '<svg class="guilloche" viewBox="0 0 336 158" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M0,79 Q84,20 168,79 Q252,138 336,79" fill="none" stroke="#2f5240" stroke-width="1.2"/>'
    + '<path d="M0,79 Q84,138 168,79 Q252,20 336,79" fill="none" stroke="#2f5240" stroke-width="1.2"/>'
    + '<path d="M0,55 Q84,10 168,55 Q252,100 336,55" fill="none" stroke="#9a8a3a" stroke-width=".8"/>'
    + '<path d="M0,103 Q84,148 168,103 Q252,58 336,103" fill="none" stroke="#9a8a3a" stroke-width=".8"/>'
    + '<ellipse cx="168" cy="79" rx="54" ry="26" fill="none" stroke="#2f5240" stroke-width=".7"/>'
    + '</svg>'

    // Serial — top center
    + '<div class="serial-top">' + serial + '</div>'

    // Corners
    + '<div class="corner tl">1</div>'
    + '<div class="corner tr">1</div>'
    + '<div class="corner bl">1</div>'
    + '<div class="corner br">1</div>'

    // Logo
    + '<div class="logo-wrap">' + LOGO + '</div>'

    // Center
    + '<div class="bill-center">'
    +   '<div class="denom-label">★ One Jingle Bill ★</div>'
    +   '<div class="jingle-word">Jingle</div>'
    +   '<div class="bills-word">Bills</div>'
    +   '<div class="divider"></div>'
    +   '<div class="company-name">Christmas Air · Plumbing · Electrical</div>'
    + '</div>'

    // Right seal
    + '<div class="seal"><div class="seal-c">CA</div><div class="seal-text">Est.<br>2018</div></div>'

    // Signature strip
    + '<div class="sig-strip">'
    +   '<div class="sig-block">'
    +     '<div class="sig-value">' + (EMP || '') + '</div>'
    +     '<div class="sig-line"></div>'
    +     '<div class="sig-label">Employee Name</div>'
    +   '</div>'
    +   '<div class="sig-mid"></div>'
    +   '<div class="sig-block">'
    +     '<div class="sig-value">' + (MGR || '') + '</div>'
    +     '<div class="sig-line"></div>'
    +     '<div class="sig-label">Authorized By</div>'
    +   '</div>'
    + '</div>'
  + '</div>';
}

const g = document.getElementById('grid');
for (let i = 0; i < 8; i++) g.innerHTML += bill(SERIALS[i]);
</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  window.open(url, '_blank');
}
