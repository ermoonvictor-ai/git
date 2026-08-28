/* Samudrik Shastra / hast-rekha interpretation layer.
   Maps the measured line & mount metrics onto classical palmistry readings. */
(function (g) {
  'use strict';

  var LINE_INFO = {
    life:  { name: 'Life Line', hi: 'जीवन रेखा', sk: 'Jeevan Rekha',
             about: 'Vitality, constitution, and the major turning points of the life course. Its length says nothing about lifespan — depth and continuity describe your energy reserve.' },
    head:  { name: 'Head Line', hi: 'मस्तिष्क रेखा', sk: 'Mastishk Rekha',
             about: 'How you think: focus, memory, decision style, and the balance between logic and imagination.' },
    heart: { name: 'Heart Line', hi: 'हृदय रेखा', sk: 'Hriday Rekha',
             about: 'Emotional temperament — how you attach, express affection, and handle being hurt.' },
    fate:  { name: 'Fate Line', hi: 'भाग्य रेखा', sk: 'Bhagya Rekha',
             about: 'Career direction and how much of your path is self-driven versus shaped by circumstance.' },
    sun:   { name: 'Sun Line', hi: 'सूर्य रेखा', sk: 'Surya Rekha',
             about: 'Recognition, creative reputation and the ease with which your work becomes visible.' },
    mercury:{ name: 'Mercury Line', hi: 'बुध रेखा', sk: 'Budh Rekha',
             about: 'Health of the digestive/nervous system and aptitude for business and communication.' },
    marriage:{ name: 'Relationship Lines', hi: 'विवाह रेखा', sk: 'Vivah Rekha',
             about: 'Significant bonds — their count, depth and timing on the percussion edge.' },
    girdle: { name: 'Girdle of Venus', hi: 'शुक्र मेखला', sk: 'Shukra Mekhala',
             about: 'Emotional sensitivity and intensity of feeling. Present in artists; can mean over-reactivity.' }
  };

  // strong / medium / faint readings per line
  var LINE_READ = {
    life: {
      strong: 'A deep, unbroken life line — a strong constitution and reserves that hold up under long strain. You recover faster than most people around you. Wide sweep around the Venus mount means warmth, appetite for life and family attachment.',
      medium: 'A clear but moderately deep life line — good baseline health with a real need for rhythm. Your energy is not unlimited; it is renewable if you sleep and eat on a schedule.',
      faint: 'A fine or shallow life line — a sensitive constitution rather than a weak one. You run on nervous energy and burn out before you notice. Regular rest is not optional for you.',
      broken: 'Breaks and overlaps along the life line mark change of place or change of direction — a relocation, a career pivot, or a health event that reset your habits. In palmistry an overlapping break is protective: the line continues on a new track.'
    },
    head: {
      strong: 'A long, deep head line — sustained concentration and a memory that holds detail. You think a problem all the way to the end rather than abandoning it midway. Straight run means practical, evidence-first reasoning.',
      medium: 'A well-formed head line of moderate depth — balanced thinking, able to switch between logic and instinct. You decide well when you are not rushed.',
      faint: 'A light head line — an intuitive, associative mind that dislikes long grinding tasks. You do your best work in short intense bursts, then need to step away.',
      broken: 'Interruptions in the head line indicate periods where your thinking changed direction sharply — a decision made under pressure, or an education/career you left and restarted.'
    },
    heart: {
      strong: 'A deep, well-drawn heart line — strong, durable affection. When you commit, you stay. You feel things intensely but do not perform them; loyalty over display.',
      medium: 'A balanced heart line — you feel warmly without losing yourself. You can talk about emotions when asked, though rarely first.',
      faint: 'A fine heart line — a private emotional life. You process feelings alone and reveal them slowly, which people sometimes read as distance.',
      broken: 'Breaks along the heart line record emotional turning points — a loss or betrayal that changed how you trust. Classical texts read a rejoined break as a wound that healed with a lesson.'
    },
    fate: {
      strong: 'A strong fate line running up the palm — a clear sense of direction, often from early on. Your career has a spine to it; you are steering, not drifting.',
      medium: 'A partial fate line — direction found in stages rather than all at once. Typically it deepens after the head line, meaning the real path opened after a conscious decision in your late twenties or thirties.',
      faint: 'A faint or absent fate line — not a bad sign. It marks a self-made, non-linear path: freelance, entrepreneurial, or several distinct careers. You define the structure yourself instead of inheriting one.',
      broken: 'A fate line with breaks shows career resets. Each break is a job or field left behind; the line resuming higher means the next chapter paid better than the last.'
    },
    sun: {
      strong: 'A clear sun line — recognition finds you. Your work gets noticed without you having to push it, and reputation compounds.',
      medium: 'A moderate sun line — recognition comes in phases, usually tied to a specific project rather than continuous fame.',
      faint: 'A weak sun line — you do substantial work quietly. Visibility is something you will have to build deliberately; it will not arrive on its own.',
      broken: 'A segmented sun line — bursts of recognition separated by quiet years. Very common in creative and technical careers.'
    },
    mercury: {
      strong: 'A clear mercury line — quick commercial instinct and persuasive speech. Also a well-functioning digestion when this line is clean.',
      medium: 'A moderate mercury line — capable in business and communication when you prepare; less so when improvising.',
      faint: 'Little or no mercury line — classically a good sign for health (this line often deepens under digestive or nervous strain). Business skill here is learned rather than instinctive.',
      broken: 'A wavy mercury line traditionally points to digestive irregularity and periods of nervous overload. Read it as a prompt to check your gut health and sleep.'
    },
    girdle: {
      strong: 'A pronounced Girdle of Venus — high emotional sensitivity and aesthetic response. Powerful in art and in reading people; exhausting if you do not protect your own boundaries.',
      medium: 'A partial girdle — emotionally responsive without being ruled by it.',
      faint: 'No significant girdle — steady, unruffled emotional baseline.',
      broken: 'A fragmented girdle — sensitivity that comes and goes with your state; strong empathy under stress.'
    }
  };

  var MOUNT_READ = {
    Jupiter: { name: 'Mount of Jupiter', hi: 'गुरु पर्वत', pos: 'under the index finger',
      high: 'Ambition and natural authority. You take charge without being asked and dislike being managed.',
      norm: 'Healthy confidence — you lead when it is needed and step back when it is not.',
      low: 'You underrate your own authority. Leadership works for you, but you have to be pushed into it.' },
    Saturn: { name: 'Mount of Saturn', hi: 'शनि पर्वत', pos: 'under the middle finger',
      high: 'Seriousness, patience and a taste for solitude. You are the one who finishes the long, unglamorous work.',
      norm: 'Balanced responsibility — disciplined without being grim.',
      low: 'You resist routine and structure. Freedom suits you more than institutions.' },
    Sun: { name: 'Mount of Apollo', hi: 'सूर्य पर्वत', pos: 'under the ring finger',
      high: 'Creative flair and a genuine eye for beauty. You want your work to be seen and it deserves to be.',
      norm: 'Appreciates quality; creative in a practical register.',
      low: 'Substance over show. You would rather be useful than admired.' },
    Mercury: { name: 'Mount of Mercury', hi: 'बुध पर्वत', pos: 'under the little finger',
      high: 'Sharp with words, numbers and negotiation. Persuasive, quick, commercially alert.',
      norm: 'Communicates clearly and honestly; competent in dealings.',
      low: 'You dislike selling and bargaining, and prefer plain direct speech.' },
    Venus: { name: 'Mount of Venus', hi: 'शुक्र पर्वत', pos: 'the ball of the thumb',
      high: 'Warmth, physical vitality, strong family feeling and love of comfort and beauty.',
      norm: 'Affectionate and steady, with a healthy appetite for life.',
      low: 'Reserved affection and lower physical stamina. You show love through action rather than touch.' },
    Luna: { name: 'Mount of Luna', hi: 'चन्द्र पर्वत', pos: 'the outer base of the palm',
      high: 'Strong imagination, vivid dreams, love of travel and water. Intuition arrives before reasoning does.',
      norm: 'Good imagination held in balance with realism.',
      low: 'Grounded and literal. You trust what you can verify.' },
    UpperMars: { name: 'Mars Positive', hi: 'मंगल (ऊर्ध्व)', pos: 'between thumb and head line',
      high: 'Physical courage and a willingness to confront. You do not back away from a direct challenge.',
      norm: 'Assertive when it matters; not looking for a fight.',
      low: 'You avoid confrontation and win by patience instead.' },
    LowerMars: { name: 'Mars Negative', hi: 'मंगल (निम्न)', pos: 'below the little finger',
      high: 'Resilience — the capacity to absorb pressure for a long time without breaking.',
      norm: 'Reasonable endurance under stress.',
      low: 'Sensitive to sustained pressure; you need to remove stressors rather than out-wait them.' }
  };

  var HAND_SHAPE = {
    earth: 'Square palm, short fingers — practical, reliable, works with hands and material things.',
    air: 'Square palm, long fingers — intellectual, communicative, needs mental stimulation.',
    water: 'Long palm, long fingers — emotional, intuitive, artistic, sensitive to atmosphere.',
    fire: 'Long palm, short fingers — energetic, impulsive, charismatic, action before analysis.'
  };

  // Age-gauge along the life line (classical Cheiro scale)
  function lifeAgeAt(fraction) { return Math.round(fraction * 70); }

  g.PalmData = {
    LINE_INFO: LINE_INFO, LINE_READ: LINE_READ,
    MOUNT_READ: MOUNT_READ, HAND_SHAPE: HAND_SHAPE, lifeAgeAt: lifeAgeAt
  };
})(window);
