/* ARX V286 - Discord-style Unicode emoji catalog.
 * Data order: Unicode Emoji 17.0 / CLDR keyboard order; skin-tone variants are intentionally collapsed.
 * Rendering: Twemoji 17.0.3 SVG, lazy-loaded inside the picker scrollport.
 */
(() => {
  'use strict';
  const CATALOG = {"people":["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","🫠","😉","😊","😇","🥰","😍","🤩","😘","😗","☺️","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🫢","🫣","🤫","🤔","🫡","🤐","🤨","😐","😑","😶","🫥","😶‍🌫️","😏","😒","🙄","😬","😮‍💨","🤥","🫨","🙂‍↔️","🙂‍↕️","😌","😔","😪","🤤","😴","🫩","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","🥴","😵","😵‍💫","🤯","🤠","🥳","🥸","😎","🤓","🧐","😕","🫤","😟","🙁","☹️","😮","😯","😲","😳","🫪","🥺","🥹","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖","😺","😸","😹","😻","😼","😽","🙀","😿","😾","🙈","🙉","🙊","💌","💘","💝","💖","💗","💓","💞","💕","💟","❣️","💔","❤️‍🔥","❤️‍🩹","❤️","🩷","🧡","💛","💚","💙","🩵","💜","🤎","🖤","🩶","🤍","💋","💯","💢","🫯","💥","💫","💦","💨","🕳️","💬","👁️‍🗨️","🗨️","🗯️","💭","💤","👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","🫷","🫸","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","🫵","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦿","🦵","🦶","👂","🦻","👃","🧠","🫀","🫁","🦷","🦴","👀","👁️","👅","👄","🫦","👶","🧒","👦","👧","🧑","👱","👨","🧔","🧔‍♂️","🧔‍♀️","👨‍🦰","👨‍🦱","👨‍🦳","👨‍🦲","👩","👩‍🦰","🧑‍🦰","👩‍🦱","🧑‍🦱","👩‍🦳","🧑‍🦳","👩‍🦲","🧑‍🦲","👱‍♀️","👱‍♂️","🧓","👴","👵","🙍","🙍‍♂️","🙍‍♀️","🙎","🙎‍♂️","🙎‍♀️","🙅","🙅‍♂️","🙅‍♀️","🙆","🙆‍♂️","🙆‍♀️","💁","💁‍♂️","💁‍♀️","🙋","🙋‍♂️","🙋‍♀️","🧏","🧏‍♂️","🧏‍♀️","🙇","🙇‍♂️","🙇‍♀️","🤦","🤦‍♂️","🤦‍♀️","🤷","🤷‍♂️","🤷‍♀️","🧑‍⚕️","👨‍⚕️","👩‍⚕️","🧑‍🎓","👨‍🎓","👩‍🎓","🧑‍🏫","👨‍🏫","👩‍🏫","🧑‍⚖️","👨‍⚖️","👩‍⚖️","🧑‍🌾","👨‍🌾","👩‍🌾","🧑‍🍳","👨‍🍳","👩‍🍳","🧑‍🔧","👨‍🔧","👩‍🔧","🧑‍🏭","👨‍🏭","👩‍🏭","🧑‍💼","👨‍💼","👩‍💼","🧑‍🔬","👨‍🔬","👩‍🔬","🧑‍💻","👨‍💻","👩‍💻","🧑‍🎤","👨‍🎤","👩‍🎤","🧑‍🎨","👨‍🎨","👩‍🎨","🧑‍✈️","👨‍✈️","👩‍✈️","🧑‍🚀","👨‍🚀","👩‍🚀","🧑‍🚒","👨‍🚒","👩‍🚒","👮","👮‍♂️","👮‍♀️","🕵️","🕵️‍♂️","🕵️‍♀️","💂","💂‍♂️","💂‍♀️","🥷","👷","👷‍♂️","👷‍♀️","🫅","🤴","👸","👳","👳‍♂️","👳‍♀️","👲","🧕","🤵","🤵‍♂️","🤵‍♀️","👰","👰‍♂️","👰‍♀️","🤰","🫃","🫄","🤱","👩‍🍼","👨‍🍼","🧑‍🍼","👼","🎅","🤶","🧑‍🎄","🦸","🦸‍♂️","🦸‍♀️","🦹","🦹‍♂️","🦹‍♀️","🧙","🧙‍♂️","🧙‍♀️","🧚","🧚‍♂️","🧚‍♀️","🧛","🧛‍♂️","🧛‍♀️","🧜","🧜‍♂️","🧜‍♀️","🧝","🧝‍♂️","🧝‍♀️","🧞","🧞‍♂️","🧞‍♀️","🧟","🧟‍♂️","🧟‍♀️","🧌","🫈","💆","💆‍♂️","💆‍♀️","💇","💇‍♂️","💇‍♀️","🚶","🚶‍♂️","🚶‍♀️","🚶‍➡️","🚶‍♀️‍➡️","🚶‍♂️‍➡️","🧍","🧍‍♂️","🧍‍♀️","🧎","🧎‍♂️","🧎‍♀️","🧎‍➡️","🧎‍♀️‍➡️","🧎‍♂️‍➡️","🧑‍🦯","🧑‍🦯‍➡️","👨‍🦯","👨‍🦯‍➡️","👩‍🦯","👩‍🦯‍➡️","🧑‍🦼","🧑‍🦼‍➡️","👨‍🦼","👨‍🦼‍➡️","👩‍🦼","👩‍🦼‍➡️","🧑‍🦽","🧑‍🦽‍➡️","👨‍🦽","👨‍🦽‍➡️","👩‍🦽","👩‍🦽‍➡️","🏃","🏃‍♂️","🏃‍♀️","🏃‍➡️","🏃‍♀️‍➡️","🏃‍♂️‍➡️","🧑‍🩰","💃","🕺","🕴️","👯","👯‍♂️","👯‍♀️","🧖","🧖‍♂️","🧖‍♀️","🧗","🧗‍♂️","🧗‍♀️","🤺","🏇","⛷️","🏂","🏌️","🏌️‍♂️","🏌️‍♀️","🏄","🏄‍♂️","🏄‍♀️","🚣","🚣‍♂️","🚣‍♀️","🏊","🏊‍♂️","🏊‍♀️","⛹️","⛹️‍♂️","⛹️‍♀️","🏋️","🏋️‍♂️","🏋️‍♀️","🚴","🚴‍♂️","🚴‍♀️","🚵","🚵‍♂️","🚵‍♀️","🤸","🤸‍♂️","🤸‍♀️","🤼","🤼‍♂️","🤼‍♀️","🤽","🤽‍♂️","🤽‍♀️","🤾","🤾‍♂️","🤾‍♀️","🤹","🤹‍♂️","🤹‍♀️","🧘","🧘‍♂️","🧘‍♀️","🛀","🛌","🧑‍🤝‍🧑","👭","👫","👬","💏","👩‍❤️‍💋‍👨","👨‍❤️‍💋‍👨","👩‍❤️‍💋‍👩","💑","👩‍❤️‍👨","👨‍❤️‍👨","👩‍❤️‍👩","👨‍👩‍👦","👨‍👩‍👧","👨‍👩‍👧‍👦","👨‍👩‍👦‍👦","👨‍👩‍👧‍👧","👨‍👨‍👦","👨‍👨‍👧","👨‍👨‍👧‍👦","👨‍👨‍👦‍👦","👨‍👨‍👧‍👧","👩‍👩‍👦","👩‍👩‍👧","👩‍👩‍👧‍👦","👩‍👩‍👦‍👦","👩‍👩‍👧‍👧","👨‍👦","👨‍👦‍👦","👨‍👧","👨‍👧‍👦","👨‍👧‍👧","👩‍👦","👩‍👦‍👦","👩‍👧","👩‍👧‍👦","👩‍👧‍👧","🗣️","👤","👥","🫂","👪","🧑‍🧑‍🧒","🧑‍🧑‍🧒‍🧒","🧑‍🧒","🧑‍🧒‍🧒","👣","🫆"],"nature":["🐵","🐒","🦍","🦧","🐶","🐕","🦮","🐕‍🦺","🐩","🐺","🦊","🦝","🐱","🐈","🐈‍⬛","🦁","🐯","🐅","🐆","🐴","🫎","🫏","🐎","🦄","🦓","🦌","🦬","🐮","🐂","🐃","🐄","🐷","🐖","🐗","🐽","🐏","🐑","🐐","🐪","🐫","🦙","🦒","🐘","🦣","🦏","🦛","🐭","🐁","🐀","🐹","🐰","🐇","🐿️","🦫","🦔","🦇","🐻","🐻‍❄️","🐨","🐼","🦥","🦦","🦨","🦘","🦡","🐾","🦃","🐔","🐓","🐣","🐤","🐥","🐦","🐧","🕊️","🦅","🦆","🦢","🦉","🦤","🪶","🦩","🦚","🦜","🪽","🐦‍⬛","🪿","🐦‍🔥","🐸","🐊","🐢","🦎","🐍","🐲","🐉","🦕","🦖","🐳","🐋","🐬","🫍","🦭","🐟","🐠","🐡","🦈","🐙","🐚","🪸","🪼","🦀","🦞","🦐","🦑","🦪","🐌","🦋","🐛","🐜","🐝","🪲","🐞","🦗","🪳","🕷️","🕸️","🦂","🦟","🪰","🪱","🦠","💐","🌸","💮","🪷","🏵️","🌹","🥀","🌺","🌻","🌼","🌷","🪻","🌱","🪴","🌲","🌳","🌴","🌵","🌾","🌿","☘️","🍀","🍁","🍂","🍃","🪹","🪺","🍄","🪾"],"food":["🍇","🍈","🍉","🍊","🍋","🍋‍🟩","🍌","🍍","🥭","🍎","🍏","🍐","🍑","🍒","🍓","🫐","🥝","🍅","🫒","🥥","🥑","🍆","🥔","🥕","🌽","🌶️","🫑","🥒","🥬","🥦","🧄","🧅","🥜","🫘","🌰","🫚","🫛","🍄‍🟫","🫜","🍞","🥐","🥖","🫓","🥨","🥯","🥞","🧇","🧀","🍖","🍗","🥩","🥓","🍔","🍟","🍕","🌭","🥪","🌮","🌯","🫔","🥙","🧆","🥚","🍳","🥘","🍲","🫕","🥣","🥗","🍿","🧈","🧂","🥫","🍱","🍘","🍙","🍚","🍛","🍜","🍝","🍠","🍢","🍣","🍤","🍥","🥮","🍡","🥟","🥠","🥡","🍦","🍧","🍨","🍩","🍪","🎂","🍰","🧁","🥧","🍫","🍬","🍭","🍮","🍯","🍼","🥛","☕","🫖","🍵","🍶","🍾","🍷","🍸","🍹","🍺","🍻","🥂","🥃","🫗","🥤","🧋","🧃","🧉","🧊","🥢","🍽️","🍴","🥄","🔪","🫙","🏺"],"activities":["🎃","🎄","🎆","🎇","🧨","✨","🎈","🎉","🎊","🎋","🎍","🎎","🎏","🎐","🎑","🧧","🎀","🎁","🎗️","🎟️","🎫","🎖️","🏆","🏅","🥇","🥈","🥉","⚽","⚾","🥎","🏀","🏐","🏈","🏉","🎾","🥏","🎳","🏏","🏑","🏒","🥍","🏓","🏸","🥊","🥋","🥅","⛳","⛸️","🎣","🤿","🎽","🎿","🛷","🥌","🎯","🪀","🪁","🔫","🎱","🔮","🪄","🎮","🕹️","🎰","🎲","🧩","🧸","🪅","🪩","🪆","♠️","♥️","♦️","♣️","♟️","🃏","🀄","🎴","🎭","🖼️","🎨","🧵","🪡","🧶","🪢"],"travel":["🌍","🌎","🌏","🌐","🗺️","🗾","🧭","🏔️","⛰️","🛘","🌋","🗻","🏕️","🏖️","🏜️","🏝️","🏞️","🏟️","🏛️","🏗️","🧱","🪨","🪵","🛖","🏘️","🏚️","🏠","🏡","🏢","🏣","🏤","🏥","🏦","🏨","🏩","🏪","🏫","🏬","🏭","🏯","🏰","💒","🗼","🗽","⛪","🕌","🛕","🕍","⛩️","🕋","⛲","⛺","🌁","🌃","🏙️","🌄","🌅","🌆","🌇","🌉","♨️","🎠","🛝","🎡","🎢","💈","🎪","🚂","🚃","🚄","🚅","🚆","🚇","🚈","🚉","🚊","🚝","🚞","🚋","🚌","🚍","🚎","🚐","🚑","🚒","🚓","🚔","🚕","🚖","🚗","🚘","🚙","🛻","🚚","🚛","🚜","🏎️","🏍️","🛵","🦽","🦼","🛺","🚲","🛴","🛹","🛼","🚏","🛣️","🛤️","🛢️","⛽","🛞","🚨","🚥","🚦","🛑","🚧","⚓","🛟","⛵","🛶","🚤","🛳️","⛴️","🛥️","🚢","✈️","🛩️","🛫","🛬","🪂","💺","🚁","🚟","🚠","🚡","🛰️","🚀","🛸","🛎️","🧳","⌛","⏳","⌚","⏰","⏱️","⏲️","🕰️","🕛","🕧","🕐","🕜","🕑","🕝","🕒","🕞","🕓","🕟","🕔","🕠","🕕","🕡","🕖","🕢","🕗","🕣","🕘","🕤","🕙","🕥","🕚","🕦","🌑","🌒","🌓","🌔","🌕","🌖","🌗","🌘","🌙","🌚","🌛","🌜","🌡️","☀️","🌝","🌞","🪐","⭐","🌟","🌠","🌌","☁️","⛅","⛈️","🌤️","🌥️","🌦️","🌧️","🌨️","🌩️","🌪️","🌫️","🌬️","🌀","🌈","🌂","☂️","☔","⛱️","⚡","❄️","☃️","⛄","☄️","🔥","💧","🌊"],"objects":["👓","🕶️","🥽","🥼","🦺","👔","👕","👖","🧣","🧤","🧥","🧦","👗","👘","🥻","🩱","🩲","🩳","👙","👚","🪭","👛","👜","👝","🛍️","🎒","🩴","👞","👟","🥾","🥿","👠","👡","🩰","👢","🪮","👑","👒","🎩","🎓","🧢","🪖","⛑️","📿","💄","💍","💎","🔇","🔈","🔉","🔊","📢","📣","📯","🔔","🔕","🎼","🎵","🎶","🎙️","🎚️","🎛️","🎤","🎧","📻","🎷","🎺","🪊","🪗","🎸","🎹","🎻","🪕","🥁","🪘","🪇","🪈","🪉","📱","📲","☎️","📞","📟","📠","🔋","🪫","🔌","💻","🖥️","🖨️","⌨️","🖱️","🖲️","💽","💾","💿","📀","🧮","🎥","🎞️","📽️","🎬","📺","📷","📸","📹","📼","🔍","🔎","🕯️","💡","🔦","🏮","🪔","📔","📕","📖","📗","📘","📙","📚","📓","📒","📃","📜","📄","📰","🗞️","📑","🔖","🏷️","🪙","💰","🪎","💴","💵","💶","💷","💸","💳","🧾","💹","✉️","📧","📨","📩","📤","📥","📦","📫","📪","📬","📭","📮","🗳️","✏️","✒️","🖋️","🖊️","🖌️","🖍️","📝","💼","📁","📂","🗂️","📅","📆","🗒️","🗓️","📇","📈","📉","📊","📋","📌","📍","📎","🖇️","📏","📐","✂️","🗃️","🗄️","🗑️","🔒","🔓","🔏","🔐","🔑","🗝️","🔨","🪓","⛏️","⚒️","🛠️","🗡️","⚔️","💣","🪃","🏹","🛡️","🪚","🔧","🪛","🔩","⚙️","🗜️","⚖️","🦯","🔗","⛓️‍💥","⛓️","🪝","🧰","🧲","🪜","🪏","⚗️","🧪","🧫","🧬","🔬","🔭","📡","💉","🩸","💊","🩹","🩼","🩺","🩻","🚪","🛗","🪞","🪟","🛏️","🛋️","🪑","🚽","🪠","🚿","🛁","🪤","🪒","🧴","🧷","🧹","🧺","🧻","🪣","🧼","🫧","🪥","🧽","🧯","🛒","🚬","⚰️","🪦","⚱️","🧿","🪬","🗿","🪧","🪪"],"symbols":["🏧","🚮","🚰","♿","🚹","🚺","🚻","🚼","🚾","🛂","🛃","🛄","🛅","⚠️","🚸","⛔","🚫","🚳","🚭","🚯","🚱","🚷","📵","🔞","☢️","☣️","⬆️","↗️","➡️","↘️","⬇️","↙️","⬅️","↖️","↕️","↔️","↩️","↪️","⤴️","⤵️","🔃","🔄","🔙","🔚","🔛","🔜","🔝","🛐","⚛️","🕉️","✡️","☸️","☯️","✝️","☦️","☪️","☮️","🕎","🔯","🪯","♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","⛎","🔀","🔁","🔂","▶️","⏩","⏭️","⏯️","◀️","⏪","⏮️","🔼","⏫","🔽","⏬","⏸️","⏹️","⏺️","⏏️","🎦","🔅","🔆","📶","🛜","📳","📴","♀️","♂️","⚧️","✖️","➕","➖","➗","🟰","♾️","‼️","⁉️","❓","❔","❕","❗","〰️","💱","💲","⚕️","♻️","⚜️","🔱","📛","🔰","⭕","✅","☑️","✔️","❌","❎","➰","➿","〽️","✳️","✴️","❇️","©️","®️","™️","🫟","#️⃣","*️⃣","0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟","🔠","🔡","🔢","🔣","🔤","🅰️","🆎","🅱️","🆑","🆒","🆓","ℹ️","🆔","Ⓜ️","🆕","🆖","🅾️","🆗","🅿️","🆘","🆙","🆚","🈁","🈂️","🈷️","🈶","🈯","🉐","🈹","🈚","🈲","🉑","🈸","🈴","🈳","㊗️","㊙️","🈺","🈵","🔴","🟠","🟡","🟢","🔵","🟣","🟤","⚫","⚪","🟥","🟧","🟨","🟩","🟦","🟪","🟫","⬛","⬜","◼️","◻️","◾","◽","▪️","▫️","🔶","🔷","🔸","🔹","🔺","🔻","💠","🔘","🔳","🔲"],"flags":["🏁","🚩","🎌","🏴","🏳️","🏳️‍🌈","🏳️‍⚧️","🏴‍☠️","🇦🇨","🇦🇩","🇦🇪","🇦🇫","🇦🇬","🇦🇮","🇦🇱","🇦🇲","🇦🇴","🇦🇶","🇦🇷","🇦🇸","🇦🇹","🇦🇺","🇦🇼","🇦🇽","🇦🇿","🇧🇦","🇧🇧","🇧🇩","🇧🇪","🇧🇫","🇧🇬","🇧🇭","🇧🇮","🇧🇯","🇧🇱","🇧🇲","🇧🇳","🇧🇴","🇧🇶","🇧🇷","🇧🇸","🇧🇹","🇧🇻","🇧🇼","🇧🇾","🇧🇿","🇨🇦","🇨🇨","🇨🇩","🇨🇫","🇨🇬","🇨🇭","🇨🇮","🇨🇰","🇨🇱","🇨🇲","🇨🇳","🇨🇴","🇨🇵","🇨🇶","🇨🇷","🇨🇺","🇨🇻","🇨🇼","🇨🇽","🇨🇾","🇨🇿","🇩🇪","🇩🇬","🇩🇯","🇩🇰","🇩🇲","🇩🇴","🇩🇿","🇪🇦","🇪🇨","🇪🇪","🇪🇬","🇪🇭","🇪🇷","🇪🇸","🇪🇹","🇪🇺","🇫🇮","🇫🇯","🇫🇰","🇫🇲","🇫🇴","🇫🇷","🇬🇦","🇬🇧","🇬🇩","🇬🇪","🇬🇫","🇬🇬","🇬🇭","🇬🇮","🇬🇱","🇬🇲","🇬🇳","🇬🇵","🇬🇶","🇬🇷","🇬🇸","🇬🇹","🇬🇺","🇬🇼","🇬🇾","🇭🇰","🇭🇲","🇭🇳","🇭🇷","🇭🇹","🇭🇺","🇮🇨","🇮🇩","🇮🇪","🇮🇱","🇮🇲","🇮🇳","🇮🇴","🇮🇶","🇮🇷","🇮🇸","🇮🇹","🇯🇪","🇯🇲","🇯🇴","🇯🇵","🇰🇪","🇰🇬","🇰🇭","🇰🇮","🇰🇲","🇰🇳","🇰🇵","🇰🇷","🇰🇼","🇰🇾","🇰🇿","🇱🇦","🇱🇧","🇱🇨","🇱🇮","🇱🇰","🇱🇷","🇱🇸","🇱🇹","🇱🇺","🇱🇻","🇱🇾","🇲🇦","🇲🇨","🇲🇩","🇲🇪","🇲🇫","🇲🇬","🇲🇭","🇲🇰","🇲🇱","🇲🇲","🇲🇳","🇲🇴","🇲🇵","🇲🇶","🇲🇷","🇲🇸","🇲🇹","🇲🇺","🇲🇻","🇲🇼","🇲🇽","🇲🇾","🇲🇿","🇳🇦","🇳🇨","🇳🇪","🇳🇫","🇳🇬","🇳🇮","🇳🇱","🇳🇴","🇳🇵","🇳🇷","🇳🇺","🇳🇿","🇴🇲","🇵🇦","🇵🇪","🇵🇫","🇵🇬","🇵🇭","🇵🇰","🇵🇱","🇵🇲","🇵🇳","🇵🇷","🇵🇸","🇵🇹","🇵🇼","🇵🇾","🇶🇦","🇷🇪","🇷🇴","🇷🇸","🇷🇺","🇷🇼","🇸🇦","🇸🇧","🇸🇨","🇸🇩","🇸🇪","🇸🇬","🇸🇭","🇸🇮","🇸🇯","🇸🇰","🇸🇱","🇸🇲","🇸🇳","🇸🇴","🇸🇷","🇸🇸","🇸🇹","🇸🇻","🇸🇽","🇸🇾","🇸🇿","🇹🇦","🇹🇨","🇹🇩","🇹🇫","🇹🇬","🇹🇭","🇹🇯","🇹🇰","🇹🇱","🇹🇲","🇹🇳","🇹🇴","🇹🇷","🇹🇹","🇹🇻","🇹🇼","🇹🇿","🇺🇦","🇺🇬","🇺🇲","🇺🇳","🇺🇸","🇺🇾","🇺🇿","🇻🇦","🇻🇨","🇻🇪","🇻🇬","🇻🇮","🇻🇳","🇻🇺","🇼🇫","🇼🇸","🇽🇰","🇾🇪","🇾🇹","🇿🇦","🇿🇲","🇿🇼","🏴󠁧󠁢󠁥󠁮󠁧󠁿","🏴󠁧󠁢󠁳󠁣󠁴󠁿","🏴󠁧󠁢󠁷󠁬󠁳󠁿"]};
  const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/svg/';
  const CATEGORY_ORDER = ['people','nature','food','activities','travel','objects','symbols','flags'];
  const CATEGORY_ICONS = Object.fromEntries(CATEGORY_ORDER.map(id => [id, `/static/emoji_categories/${id}.png`]));
  const LABELS = {
    tr: {people:'İnsanlar',nature:'Doğa',food:'Yemek',activities:'Aktiviteler',travel:'Seyahat',objects:'Nesneler',symbols:'Semboller',flags:'Bayraklar'},
    en: {people:'People',nature:'Nature',food:'Food',activities:'Activities',travel:'Travel',objects:'Objects',symbols:'Symbols',flags:'Flags'},
    de: {people:'Menschen',nature:'Natur',food:'Essen',activities:'Aktivitäten',travel:'Reisen',objects:'Objekte',symbols:'Symbole',flags:'Flaggen'},
    fr: {people:'Personnes',nature:'Nature',food:'Nourriture',activities:'Activités',travel:'Voyage',objects:'Objets',symbols:'Symboles',flags:'Drapeaux'},
    es: {people:'Personas',nature:'Naturaleza',food:'Comida',activities:'Actividades',travel:'Viajes',objects:'Objetos',symbols:'Símbolos',flags:'Banderas'},
    pt: {people:'Pessoas',nature:'Natureza',food:'Comida',activities:'Atividades',travel:'Viagem',objects:'Objetos',symbols:'Símbolos',flags:'Bandeiras'},
    ru: {people:'Люди',nature:'Природа',food:'Еда',activities:'Активности',travel:'Путешествия',objects:'Предметы',symbols:'Символы',flags:'Флаги'},
    ja: {people:'人・顔',nature:'自然',food:'食べ物',activities:'アクティビティ',travel:'旅行',objects:'物',symbols:'記号',flags:'旗'},
    ko: {people:'사람',nature:'자연',food:'음식',activities:'활동',travel:'여행',objects:'사물',symbols:'기호',flags:'깃발'},
    ar: {people:'الأشخاص',nature:'الطبيعة',food:'الطعام',activities:'الأنشطة',travel:'السفر',objects:'الأشياء',symbols:'الرموز',flags:'الأعلام'}
  };
  const COMMON_ALIASES = {
    '😀':'happy smile mutlu gülümse gulumse yüz yuz', '😃':'happy smile mutlu gülümse gulumse', '😄':'happy smile mutlu gülümse gulumse',
    '😁':'happy smile grin mutlu gülümse gulumse', '😂':'joy laugh laughing tears kahkaha gülmek gulmek', '🤣':'laugh laughing kahkaha',
    '😊':'happy smile blush mutlu gülümse gulumse', '😍':'love heart eyes aşk ask kalp', '🥰':'love hearts aşk ask kalp',
    '❤️':'heart love red kalp aşk ask kırmızı kirmizi', '🩷':'heart pink kalp pembe', '💛':'heart yellow kalp sarı sari', '💙':'heart blue kalp mavi',
    '💚':'heart green kalp yeşil yesil', '💜':'heart purple kalp mor', '🖤':'heart black kalp siyah', '🤍':'heart white kalp beyaz',
    '🙈':'monkey maymun see no evil', '🙉':'monkey maymun hear no evil', '🙊':'monkey maymun speak no evil', '🐒':'monkey maymun', '🐵':'monkey maymun',
    '🐶':'dog köpek kopek', '🐕':'dog köpek kopek', '🐱':'cat kedi', '🐈':'cat kedi', '🔥':'fire flame ateş ates', '⭐':'star yıldız yildiz',
    '✨':'sparkles sparkle parıltı parilti', '✅':'check yes onay doğru dogru', '❌':'cross no yanlış yanlis', '⚠️':'warning alert uyarı uyari',
    '🎮':'game gaming oyun', '⚽':'football soccer futbol', '🏀':'basketball basketbol', '🚗':'car araba otomobil', '🚲':'bike bicycle bisiklet',
    '✈️':'plane airplane uçak ucak', '🚀':'rocket roket', '🍔':'burger hamburger', '🍕':'pizza', '🍎':'apple elma', '☕':'coffee kahve',
    '🎉':'party confetti celebration kutlama', '🎁':'gift present hediye', '👑':'crown kral taç tac', '💎':'diamond elmas', '🔒':'lock kilit', '🔓':'unlock kilit açık acik'
  };
  const normalizeLang = () => {
    const raw = String(document.documentElement.lang || 'en').toLowerCase().replace('_','-');
    const code = raw.split('-')[0];
    return LABELS[code] ? code : 'en';
  };
  const codePointKey = value => Array.from(String(value || ''))
    .map(ch => ch.codePointAt(0).toString(16).toLowerCase())
    .filter(cp => cp !== 'fe0f')
    .join('-');
  const flagCode = value => {
    const points = Array.from(String(value || '')).map(ch => ch.codePointAt(0));
    if (points.length === 2 && points.every(cp => cp >= 0x1F1E6 && cp <= 0x1F1FF))
      return String.fromCharCode(...points.map(cp => 65 + cp - 0x1F1E6)).toLowerCase();
    return '';
  };
  const buildSearchText = (emoji, category, labels) => [
    emoji, category, ...Object.values(labels), COMMON_ALIASES[emoji] || '', flagCode(emoji)
  ].join(' ').toLocaleLowerCase();
  const makeLazyObserver = root => 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      if (img.dataset.src && !img.src) img.src = img.dataset.src;
      root._arxEmojiImageObserver?.unobserve(img);
    });
  }, {root, rootMargin:'560px'}) : null;

  function mount({grid, search, dataAttribute='data-command-emoji', serverGrid=null} = {}) {
    if (!grid) return null;
    if (grid._arxDiscordCatalogApi) return grid._arxDiscordCatalogApi;
    const lang = normalizeLang();
    const labels = LABELS[lang];
    const section = grid.closest('.role-emoji-section');
    const dialog = grid.closest('dialog');
    const guildName = String(dialog?.dataset.arxGuildName || 'Discord');
    const guildIcon = String(dialog?.dataset.arxGuildIcon || '');
    serverGrid = serverGrid || dialog?.querySelector('[data-arx-server-emojis]') || null;
    const serverSection = serverGrid?.closest('[data-arx-server-emoji-section]') || serverGrid?.closest('.role-emoji-section') || null;

    grid.innerHTML = '';
    grid.classList.add('arx-discord-emoji-catalog');
    grid.dataset.arxDiscordCatalog = '1';

    const shell = document.createElement('div');
    shell.className = 'arx-discord-emoji-shell';
    const rail = document.createElement('nav');
    rail.className = 'arx-emoji-category-bar';
    rail.setAttribute('aria-label', 'Emoji categories');
    if (section && grid.parentNode === section) {
      section.classList.add('arx-native-emoji-section');
      const oldTitle = section.querySelector(':scope > strong');
      if (oldTitle) oldTitle.classList.add('arx-native-emoji-title');
      section.insertBefore(shell, grid);
      shell.append(rail, grid);
    } else {
      grid.parentNode?.insertBefore(rail, grid);
    }

    const imageObserver = makeLazyObserver(grid);
    grid._arxEmojiImageObserver = imageObserver;
    const groups = new Map();
    const railButtons = new Map();
    const navOrder = [];
    let integratedServerCount = 0;
    const frag = document.createDocumentFragment();

    const createNav = (id, label, iconUrl='', fallback='') => {
      const nav = document.createElement('button');
      nav.type = 'button';
      nav.className = `arx-emoji-category${id === 'server' ? ' arx-emoji-server-category' : ''}`;
      nav.dataset.emojiCategoryJump = id;
      nav.title = label;
      nav.setAttribute('aria-label', label);
      if (iconUrl) {
        const icon = document.createElement('img');
        icon.src = iconUrl;
        icon.alt = '';
        icon.loading = 'eager';
        if (id === 'server') icon.className = 'arx-emoji-server-icon';
        nav.append(icon);
      } else {
        const mark = document.createElement('span');
        mark.className = 'arx-emoji-server-fallback';
        mark.textContent = fallback || '?';
        nav.append(mark);
      }
      nav.addEventListener('click', () => {
        const target = groups.get(id);
        if (!target) return;
        const top = Math.max(0, target.offsetTop - grid.offsetTop - 4);
        grid.scrollTo({top, behavior:'smooth'});
      });
      rail.append(nav);
      railButtons.set(id, nav);
      navOrder.push(id);
      return nav;
    };

    if (serverGrid) {
      const serverGroup = document.createElement('section');
      serverGroup.className = 'arx-emoji-group arx-server-emoji-group';
      serverGroup.dataset.emojiCategory = 'server';
      const heading = document.createElement('div');
      heading.className = 'arx-emoji-group-heading';
      heading.textContent = guildName;
      const inner = document.createElement('div');
      inner.className = 'arx-emoji-group-grid arx-server-emoji-grid';
      const sourceButtons = [...serverGrid.querySelectorAll(`[${dataAttribute}]`)];
      integratedServerCount = sourceButtons.length;
      if (sourceButtons.length) {
        sourceButtons.forEach(button => {
          button.classList.add('arx-server-emoji-option');
          const value = String(button.getAttribute(dataAttribute) || '');
          const name = String(button.getAttribute(`${dataAttribute}-name`) || button.querySelector('small')?.textContent || '');
          button.dataset.arxSearch = `${name} ${value} ${guildName}`.toLocaleLowerCase(lang);
          const image = button.querySelector('img');
          if (image) { image.loading = 'lazy'; image.decoding = 'async'; }
          inner.append(button);
        });
      } else {
        const empty = document.createElement('div');
        empty.className = 'arx-server-emoji-empty';
        empty.textContent = '—';
        inner.append(empty);
      }
      serverGroup.append(heading, inner);
      frag.append(serverGroup);
      groups.set('server', serverGroup);
      const initial = (guildName.trim().charAt(0) || 'D').toLocaleUpperCase(lang);
      createNav('server', guildName, guildIcon, initial);
      if (serverSection) serverSection.hidden = true;
    }

    CATEGORY_ORDER.forEach(category => {
      const group = document.createElement('section');
      group.className = 'arx-emoji-group';
      group.dataset.emojiCategory = category;
      const heading = document.createElement('div');
      heading.className = 'arx-emoji-group-heading';
      heading.textContent = labels[category];
      const inner = document.createElement('div');
      inner.className = 'arx-emoji-group-grid';
      const groupFrag = document.createDocumentFragment();
      for (const emoji of CATALOG[category] || []) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'role-emoji-option arx-discord-native-emoji';
        button.setAttribute(dataAttribute, emoji);
        button.setAttribute(`${dataAttribute}-name`, buildSearchText(emoji, category, labels));
        button.dataset.arxNativeEmoji = '1';
        button.dataset.arxSearch = buildSearchText(emoji, category, labels);
        button.title = emoji;
        const img = document.createElement('img');
        img.className = 'arx-twemoji';
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.dataset.src = `${TWEMOJI_BASE}${codePointKey(emoji)}.svg`;
        const fallback = document.createElement('span');
        fallback.className = 'role-native-emoji arx-emoji-fallback';
        fallback.textContent = emoji;
        fallback.hidden = true;
        img.addEventListener('load', () => {
          img.classList.add('is-loaded');
          fallback.remove();
        }, {once:true});
        img.addEventListener('error', () => {
          img.remove();
          fallback.hidden = false;
        }, {once:true});
        button.append(img, fallback);
        groupFrag.append(button);
        if (imageObserver) imageObserver.observe(img); else img.src = img.dataset.src;
      }
      inner.append(groupFrag);
      group.append(heading, inner);
      frag.append(group);
      groups.set(category, group);
      createNav(category, labels[category], CATEGORY_ICONS[category]);
    });
    grid.append(frag);

    const firstVisible = () => navOrder.find(id => {
      const group = groups.get(id);
      return group && !group.hidden;
    }) || 'people';
    const updateActive = () => {
      const currentTop = grid.scrollTop + 42;
      let active = firstVisible();
      for (const id of navOrder) {
        const group = groups.get(id);
        if (group && !group.hidden && group.offsetTop - grid.offsetTop <= currentTop) active = id;
      }
      railButtons.forEach((button, id) => button.classList.toggle('active', id === active));
    };
    let scrollRaf = 0;
    grid.addEventListener('scroll', () => {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {scrollRaf = 0; updateActive();});
    }, {passive:true});

    let searchTimer = 0;
    const applySearch = () => {
      const q = String(search?.value || '').trim().toLocaleLowerCase(lang);
      let any = false;
      for (const id of navOrder) {
        const group = groups.get(id);
        if (!group) continue;
        let visible = 0;
        if (id === 'server') {
          group.querySelectorAll(`[${dataAttribute}]`).forEach(button => {
            const hay = String(button.dataset.arxSearch || '').toLocaleLowerCase(lang);
            const match = !q || hay.includes(q);
            button.hidden = !match;
            if (match) visible++;
          });
          group.hidden = !!q && visible === 0;
        } else {
          group.querySelectorAll('.arx-discord-native-emoji').forEach(button => {
            const match = !q || String(button.dataset.arxSearch || '').includes(q);
            button.hidden = !match;
            if (match) visible++;
          });
          group.hidden = !!q && visible === 0;
        }
        railButtons.get(id)?.toggleAttribute('hidden', !!q && visible === 0);
        if (visible) any = true;
      }
      grid.classList.toggle('arx-emoji-no-results', !!q && !any);
      if (q) grid.scrollTop = 0;
      updateActive();
    };
    if (search) search.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(applySearch, 70);
    });

    const api = {
      reset() {
        if (search) search.value = '';
        for (const id of navOrder) {
          const group = groups.get(id);
          if (group) group.hidden = false;
          railButtons.get(id)?.removeAttribute('hidden');
          if (id === 'server') {
            group?.querySelectorAll(`[${dataAttribute}]`).forEach(button => button.hidden = false);
          } else {
            group?.querySelectorAll('.arx-discord-native-emoji').forEach(button => button.hidden = false);
          }
        }
        grid.classList.remove('arx-emoji-no-results');
        grid.scrollTop = 0;
        updateActive();
      },
      filter: applySearch,
      count: CATEGORY_ORDER.reduce((n,id) => n + (CATALOG[id]?.length || 0), 0),
      serverCount: integratedServerCount
    };
    grid._arxDiscordCatalogApi = api;
    updateActive();
    return api;
  }

  window.ARXBotCommandsEmoji = {mount, catalogVersion:'unicode-17.0', renderer:'twemoji-17.0.3-stable-v287'};
})();
