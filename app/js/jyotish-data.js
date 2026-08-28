/* Interpretation knowledge base — classical Parashari significations,
   nakshatra traits, house/bhava meanings, dasha effects and remedies.
   Written from traditional public-domain Jyotish sources. */
(function (g) {
  'use strict';

  var HOUSES = [
    null,
    { name: 'Tanu Bhava', hi: 'तनु भाव', title: 'Self, body, vitality',
      keys: ['personality', 'health', 'appearance', 'drive', 'the way you start things'] },
    { name: 'Dhana Bhava', hi: 'धन भाव', title: 'Wealth, speech, family',
      keys: ['savings', 'speech', 'food habits', 'immediate family', 'accumulated value'] },
    { name: 'Sahaja Bhava', hi: 'सहज भाव', title: 'Courage, siblings, effort',
      keys: ['initiative', 'younger siblings', 'short travel', 'skill of hands', 'communication'] },
    { name: 'Sukha Bhava', hi: 'सुख भाव', title: 'Home, mother, inner peace',
      keys: ['property', 'vehicles', 'mother', 'emotional base', 'education foundation'] },
    { name: 'Putra Bhava', hi: 'पुत्र भाव', title: 'Intellect, creativity, children',
      keys: ['romance', 'speculation', 'mantra', 'children', 'creative output'] },
    { name: 'Ari Bhava', hi: 'अरि भाव', title: 'Obstacles, debt, service',
      keys: ['competition', 'illness', 'daily work', 'enemies', 'discipline'] },
    { name: 'Yuvati Bhava', hi: 'युवति भाव', title: 'Partnership, marriage, trade',
      keys: ['spouse', 'business partners', 'contracts', 'public dealing'] },
    { name: 'Randhra Bhava', hi: 'रन्ध्र भाव', title: 'Transformation, longevity, secrets',
      keys: ['sudden change', 'inheritance', 'occult', 'research', 'crisis and rebirth'] },
    { name: 'Dharma Bhava', hi: 'धर्म भाव', title: 'Fortune, faith, higher learning',
      keys: ['luck', 'father', 'guru', 'long journeys', 'philosophy'] },
    { name: 'Karma Bhava', hi: 'कर्म भाव', title: 'Career, status, action',
      keys: ['profession', 'authority', 'reputation', 'public role'] },
    { name: 'Labha Bhava', hi: 'लाभ भाव', title: 'Gains, network, desires',
      keys: ['income', 'elder siblings', 'friends circle', 'fulfilled wishes'] },
    { name: 'Vyaya Bhava', hi: 'व्यय भाव', title: 'Loss, liberation, foreign lands',
      keys: ['expenditure', 'isolation', 'sleep and dreams', 'moksha', 'abroad'] }
  ];

  var PLANET_INFO = {
    Sun: { hi: 'सूर्य', sk: 'Surya', karaka: 'soul, father, authority, vitality, bones',
      good: 'confident, principled, naturally taken seriously',
      weak: 'ego bruises easily, strained authority figures, low stamina',
      day: 'Sunday', gem: 'Ruby', mantra: 'ॐ घृणि सूर्याय नमः',
      remedy: 'Offer water to the rising Sun; respect your father and elders.' },
    Moon: { hi: 'चन्द्र', sk: 'Chandra', karaka: 'mind, mother, emotion, fluids, public',
      good: 'emotionally intelligent, well-liked, adaptable',
      weak: 'mood swings, overthinking at night, unsettled sleep',
      day: 'Monday', gem: 'Pearl', mantra: 'ॐ सों सोमाय नमः',
      remedy: 'Keep water by your bed, serve your mother, avoid decisions after midnight.' },
    Mars: { hi: 'मंगल', sk: 'Mangal', karaka: 'courage, siblings, land, energy, blood',
      good: 'decisive, physically capable, protective',
      weak: 'anger, accidents, impatience, disputes over property',
      day: 'Tuesday', gem: 'Red Coral', mantra: 'ॐ अं अंगारकाय नमः',
      remedy: 'Physical training, donate red lentils on Tuesday, avoid arguing while driving.' },
    Mercury: { hi: 'बुध', sk: 'Budh', karaka: 'intellect, speech, trade, skin, nerves',
      good: 'quick learner, witty, good with numbers and words',
      weak: 'scattered focus, nervous speech, half-finished projects',
      day: 'Wednesday', gem: 'Emerald', mantra: 'ॐ बुं बुधाय नमः',
      remedy: 'Write daily, give green fodder to cows, keep your word precisely.' },
    Jupiter: { hi: 'गुरु', sk: 'Brihaspati', karaka: 'wisdom, wealth, children, guru, dharma',
      good: 'trusted advisor, expansive luck, protected in crisis',
      weak: 'over-optimism, weight and liver issues, misplaced faith',
      day: 'Thursday', gem: 'Yellow Sapphire', mantra: 'ॐ ग्रां ग्रीं ग्रौं सः गुरवे नमः',
      remedy: 'Feed and teach without charging; turmeric and yellow on Thursday.' },
    Venus: { hi: 'शुक्र', sk: 'Shukra', karaka: 'love, art, comfort, vehicles, partner',
      good: 'charming, aesthetic sense, comfortable life',
      weak: 'indulgence, relationship confusion, spending on beauty',
      day: 'Friday', gem: 'Diamond / White Sapphire', mantra: 'ॐ शुं शुक्राय नमः',
      remedy: 'Respect women in your life, keep your surroundings clean and beautiful.' },
    Saturn: { hi: 'शनि', sk: 'Shani', karaka: 'discipline, delay, labour, longevity, servants',
      good: 'endurance, mastery through repetition, late but lasting success',
      weak: 'delays, loneliness, joint pain, chronic fatigue',
      day: 'Saturday', gem: 'Blue Sapphire (test first)', mantra: 'ॐ शं शनैश्चराय नमः',
      remedy: 'Serve workers and the elderly, never break a promise, sesame oil lamp on Saturday.' },
    Rahu: { hi: 'राहु', sk: 'Rahu', karaka: 'obsession, foreign, technology, sudden rise',
      good: 'unconventional success, foreign gains, magnetic presence',
      weak: 'anxiety, illusion, shortcuts that backfire, addiction',
      day: 'Saturday', gem: 'Hessonite (Gomed)', mantra: 'ॐ रां राहवे नमः',
      remedy: 'Cut screen time at night, keep no hidden dealings, donate on Saturday evening.' },
    Ketu: { hi: 'केतु', sk: 'Ketu', karaka: 'detachment, moksha, past life, intuition, healing',
      good: 'sharp intuition, spiritual depth, mastery without seeking credit',
      weak: 'sudden losses, disinterest, feeling unrooted, vague health issues',
      day: 'Tuesday', gem: "Cat's Eye", mantra: 'ॐ कें केतवे नमः',
      remedy: 'Meditation, keep a flag/banner at a temple, donate blankets.' }
  };

  // Planet-in-house readings (Parashari core, condensed)
  var PLANET_HOUSE = {
    Sun: ['','Strong sense of self; you lead rather than follow, but must guard the ego.','Wealth through authority and government-linked work; measured speech matters.','Courageous, wins over rivals, strained bond with siblings early on.','Home is where the ego is tested; property through father.','Bright intellect, creative authority, ambitious about children.','Defeats enemies and disease through will; careful with heart and stress.','Partnership tests pride; spouse is independent and strong-willed.','Deep transformative life; interest in research or hidden matters.','Fortune rises with father and dharma; a natural teacher or guide.','Career is your identity — high visibility, real authority.','Steady gains, senior friends, income from position.','Expenses on status; life abroad or in solitude suits you.'],
    Moon: ['','Emotions are visible on your face; mind changes with company.','Sweet speech; wealth fluctuates like the tides.','Courage comes in waves; supportive sisters, restless travel.','Strong bond with mother, deep need for a settled home — the best placement for peace.','Imaginative, emotionally invested in creativity and children.','Health tracks mood; service to others heals you.','Emotionally dependent on partnership; popular in public.','Emotional intensity, psychic dreams, fear of loss.','Faith is felt rather than argued; travels far.','Public-facing career, work with people or masses.','Wide social circle, gains through women and networks.','Rich inner life, foreign lands, needs solitude to recharge.'],
    Mars: ['','Direct, physical, competitive; scars or marks on the body.','Sharp speech — words can wound; earns through effort and land.','Excellent: courage, initiative, technical skill of the hands.','Restless at home; property disputes possible, protect the mother.','Aggressive intellect, risk-taking in speculation.','Superb: destroys enemies, wins litigation, strong immunity.','Classic Mangal Dosha zone — passion plus friction in marriage.','Interest in surgery/occult; accident-prone, needs caution.','Fights for principles; argues with father or guru.','Career built on drive, engineering, defence, land or surgery.','Gains through bold action and elder siblings.','Hidden anger, secret enemies, expenses on health or land.'],
    Mercury: ['','Analytical, youthful appearance, communicative.','Earns through speech, trade, writing or brokerage.','Skilled with hands and words; excellent for writers and coders.','Educated mind, comfort through learning and documents.','Sharp intelligence, good for teaching, coding, mantra and analysis.','Wins through paperwork and detail; nervous digestion.','Business partnerships suit you; a witty, younger-seeming spouse.','Researcher instinct; interest in the hidden and the technical.','Higher study and publishing; multiple fields of interest.','Career in communication, IT, commerce, consultancy.','Income from network, media and multiple sources.','Works behind the scenes; overthinking disturbs sleep.'],
    Jupiter: ['','Blessed lagna — optimistic, respected, protected in crises.','Wealth and good food; speaks with weight and honesty.','Effort brings dharma; supports siblings but may be too easy-going.','Excellent for property, mother and inner peace.','Wisdom, teaching, children — one of the finest placements.','Even obstacles turn instructive; good for law and healing.','Fortunate partnership; a wise, principled spouse.','Protected longevity, interest in scripture and the occult.','Best house for Jupiter: fortune, faith, father, higher learning.','Career with ethical authority — teaching, law, finance, advisory.','Great gains, generous friends, fulfilled ambitions.','Charitable expenses, spiritual liberation, life abroad.'],
    Venus: ['','Attractive, refined taste, drawn to beauty and comfort.','Wealth through art, luxury or beauty; sweet voice.','Artistic effort, pleasant siblings, enjoyable short travel.','Beautiful home, vehicles, comforts, close to mother.','Romantic, creative, artistically gifted children.','Relationship becomes work; careful with indulgence and diabetes.','Marriage is central to your life story; charming spouse.','Sensitive about intimacy; gains through partner’s wealth.','Fortune through partner and art; travels for pleasure.','Career in design, media, luxury, entertainment or fashion.','Gains from art and women; a wide, pleasant network.','Best house for private pleasure and moksha — a rich inner world.'],
    Saturn: ['','Serious face, early hardship, matures young; success arrives late but stays.','Wealth builds slowly and honestly; measured speech.','Excellent: relentless effort defeats everything; the disciplined worker.','Cold or distant home life early; property comes late and stays.','Delay in children; disciplined intellect, deep concentration.','Excellent: outlasts every enemy and illness; the marathon runner.','Marriage delayed or to an older/serious partner; loyalty is the theme.','Long life, deep research, interest in death and the beyond.','Duty over faith; a father who is strict or absent.','Excellent: career of lasting authority built brick by brick.','Excellent: steady, growing income; older friends.','Solitude, foreign residence, expenses on duty; strong moksha lean.'],
    Rahu: ['','Unusual persona, magnetic, foreign associations, ambitious.','Sudden wealth and sudden loss; guard your speech.','Excellent: fearless, achieves through unconventional courage.','Restless home, likely to leave the birthplace.','Speculative gains; unconventional romance and creativity.','Excellent: destroys enemies; strong immunity to attacks.','Unconventional marriage — different culture, caste or country.','Interest in the occult; sudden events that reset life.','Questions inherited faith; foreign travel for study or work.','Excellent: sudden rise in career, especially in tech and media.','Excellent: large gains, powerful network, ambitions fulfilled.','Life abroad, spiritual searching, expenses on the unseen.'],
    Ketu: ['','Detached self-image, seeker; may feel out of place.','Careless with money; speech is blunt but true.','Effortless courage; detached from siblings.','Emotional distance from home; roots elsewhere.','Intuitive intellect, mantra siddhi, detachment about children.','Excellent: rivals dissolve on their own; healing ability.','Detachment inside marriage; needs conscious effort.','Deep occult and healing gifts; sudden turning points.','Non-conventional spirituality; questions the guru.','Detached from status even while succeeding.','Gains arrive without chasing; few but true friends.','Best house for Ketu: moksha, meditation, life abroad.']
  };

  var NAK_TRAITS = [
    { n: 'Ashwini', d: 'Fast starter, healer, restless. Deity Ashwini Kumaras — you fix things quickly.' },
    { n: 'Bharani', d: 'Carries burdens others cannot. Intense, creative, transformative.' },
    { n: 'Krittika', d: 'Sharp, cutting clarity. Burns away pretence; a natural critic and reformer.' },
    { n: 'Rohini', d: 'Magnetic, artistic, fertile. Attracts comfort and beauty; also stubborn.' },
    { n: 'Mrigashira', d: 'The searcher. Curious, travels, always looking for something better.' },
    { n: 'Ardra', d: 'Storm before clarity. Sharp intellect, emotional intensity, breakthrough thinker.' },
    { n: 'Punarvasu', d: 'Returns and renews. Resilient — you rebuild after every loss.' },
    { n: 'Pushya', d: 'The nourisher. Most auspicious nakshatra; you feed and protect others.' },
    { n: 'Ashlesha', d: 'Penetrating insight, hypnotic. Strategic mind, must guard against manipulation.' },
    { n: 'Magha', d: 'Royal ancestry, pride, tradition. You carry a lineage forward.' },
    { n: 'Purva Phalguni', d: 'Pleasure, art, romance. Warm, generous, enjoys life.' },
    { n: 'Uttara Phalguni', d: 'Steady patronage. Reliable friend, good at contracts and alliances.' },
    { n: 'Hasta', d: 'Skill of the hand. Craft, healing touch, dexterity, cleverness.' },
    { n: 'Chitra', d: 'The architect. Design sense, striking appearance, builds beautiful things.' },
    { n: 'Swati', d: 'Independent as wind. Diplomatic, business-minded, hates being controlled.' },
    { n: 'Vishakha', d: 'Goal-fixated. Achieves through single-minded pursuit; impatient.' },
    { n: 'Anuradha', d: 'Friendship and devotion. Succeeds abroad; loyal to the core.' },
    { n: 'Jyeshtha', d: 'The eldest. Protective, authoritative, carries responsibility young.' },
    { n: 'Mula', d: 'Goes to the root. Investigative, radical, dissolves old structures.' },
    { n: 'Purva Ashadha', d: 'Invincible optimism. Persuasive, philosophical, hard to defeat.' },
    { n: 'Uttara Ashadha', d: 'Final victory. Late but permanent success; ethical leadership.' },
    { n: 'Shravana', d: 'The listener. Learns by hearing; teacher, counsellor, connector.' },
    { n: 'Dhanishta', d: 'Rhythm and wealth. Musical, prosperous, group-oriented.' },
    { n: 'Shatabhisha', d: 'The healer of hundreds. Secretive, scientific, mystical.' },
    { n: 'Purva Bhadrapada', d: 'Intense, otherworldly. Passionate about ideas beyond the ordinary.' },
    { n: 'Uttara Bhadrapada', d: 'Deep still water. Wise, patient, spiritually mature.' },
    { n: 'Revati', d: 'The safe harbour. Nurturing, artistic, guides others home.' }
  ];

  var RASHI_TRAITS = [
    { s: 'Aries', d: 'Pioneer energy — you act first and think while moving. Impatience is the cost.' },
    { s: 'Taurus', d: 'Stability, taste and stubborn strength. Slow to start, impossible to stop.' },
    { s: 'Gemini', d: 'Two minds, many interests. Communicative, quick, needs variety.' },
    { s: 'Cancer', d: 'Feeling first. Protective, memory-driven, home is the anchor.' },
    { s: 'Leo', d: 'Dignity and warmth. You need to be seen doing something worth seeing.' },
    { s: 'Virgo', d: 'Precision and service. You improve everything you touch, including yourself.' },
    { s: 'Libra', d: 'Balance and relationship. Diplomatic, aesthetic, decides slowly.' },
    { s: 'Scorpio', d: 'Depth and intensity. Secretive, transformative, all-or-nothing.' },
    { s: 'Sagittarius', d: 'Meaning and freedom. Teacher, traveller, blunt truth-teller.' },
    { s: 'Capricorn', d: 'Structure and climb. Patient ambition, respected late in life.' },
    { s: 'Aquarius', d: 'Systems and outsiders. Original thinker, humanitarian, detached.' },
    { s: 'Pisces', d: 'Boundless empathy. Imaginative, spiritual, needs a container.' }
  ];

  // Mahadasha themes
  var DASHA_EFFECT = {
    Sun: 'Six years of visibility. Authority, recognition, dealings with government and father figures. Health of heart and eyes needs attention. Ego battles decide the outcome.',
    Moon: 'Ten years of feeling and movement. Mother, home, emotional life and the public come forward. Comfort grows but the mind is restless — protect your sleep.',
    Mars: 'Seven years of force. Property, siblings, competition, surgery, technical mastery. Anger is the only real enemy here; channel it into training or building.',
    Rahu: 'Eighteen years of amplification. Sudden rise, foreign links, technology, obsession. Whatever you chase, you get — so choose carefully. Avoid shortcuts.',
    Jupiter: 'Sixteen years of expansion. Wisdom, wealth, children, teaching, marriage. The most protective period; even setbacks arrive with a lesson attached.',
    Saturn: 'Nineteen years of construction. Slow, heavy, and ultimately the most solid thing you will build. Discipline is rewarded; shortcuts are punished visibly.',
    Mercury: 'Seventeen years of intelligence. Trade, writing, communication, education, travel. Multiple income lines open. Nerves and overthinking are the risk.',
    Ketu: 'Seven years of stripping away. Losses that turn out to be releases. Spiritual depth, healing ability, detachment from status. Do not start big ventures blindly.',
    Venus: 'Twenty years of pleasure and refinement. Marriage, art, comfort, vehicles, wealth. The sweetest dasha — indulgence is the only trap.'
  };

  var YOGAS = [
    { id: 'gajakesari', name: 'Gaja Kesari Yoga',
      test: function (c) {
        var m = c.planets.find(function (p) { return p.name === 'Moon'; });
        var j = c.planets.find(function (p) { return p.name === 'Jupiter'; });
        var d = Math.abs(m.house - j.house);
        return [0, 3, 6, 9].indexOf(Math.min(d, 12 - d)) >= 0;
      },
      text: 'Jupiter sits in a kendra from the Moon. Classical marker of respect, intelligence and a reputation that outlives the work. You are listened to.' },
    { id: 'budhaditya', name: 'Budha-Aditya Yoga',
      test: function (c) {
        var s = c.planets.find(function (p) { return p.name === 'Sun'; });
        var me = c.planets.find(function (p) { return p.name === 'Mercury'; });
        return s.sign === me.sign;
      },
      text: 'Sun and Mercury together — clear analytical intelligence, skill in communication, and recognition for what you know rather than who you know.' },
    { id: 'chandramangal', name: 'Chandra-Mangal Yoga',
      test: function (c) {
        var m = c.planets.find(function (p) { return p.name === 'Moon'; });
        var ma = c.planets.find(function (p) { return p.name === 'Mars'; });
        return m.sign === ma.sign;
      },
      text: 'Moon with Mars — money-making instinct, emotional drive, and the ability to act on a feeling immediately. Guard the temper.' },
    { id: 'panchmahapurush', name: 'Pancha Mahapurusha Yoga',
      test: function (c) {
        return c.planets.some(function (p) {
          return ['Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].indexOf(p.name) >= 0 &&
                 [1, 4, 7, 10].indexOf(p.house) >= 0 &&
                 (p.dignity.key === 'own' || p.dignity.key === 'exalted');
        });
      },
      text: 'A great planet stands strong in a kendra in its own or exalted sign — one of the five Mahapurusha yogas. It marks a life that rises above the ordinary in that planet’s domain.' },
    { id: 'dhana', name: 'Dhana Yoga',
      test: function (c) {
        var l2 = c.byHouse[2].length, l11 = c.byHouse[11].length;
        return l2 > 0 && l11 > 0;
      },
      text: 'Both the wealth house and the gains house are occupied — money arrives from more than one direction, and it stays.' },
    { id: 'kemadruma', name: 'Kemadruma Yoga (caution)',
      test: function (c) {
        var m = c.planets.find(function (p) { return p.name === 'Moon'; });
        return !c.planets.some(function (p) {
          if (p.name === 'Moon' || p.name === 'Rahu' || p.name === 'Ketu' || p.name === 'Sun') return false;
          var d = Math.abs(p.sign - m.sign);
          d = Math.min(d, 12 - d);
          return d <= 1;
        });
      },
      text: 'The Moon stands without support on either side. Emotional self-reliance is forced on you early. Classical texts call it a hard yoga, but it is cancelled by a strong Moon or a kendra Jupiter — and it produces unusually independent people.' },
    { id: 'sarala', name: 'Viparita Raja Yoga',
      test: function (c) {
        return c.byHouse[6].concat(c.byHouse[8], c.byHouse[12]).some(function (p) {
          return ['Saturn', 'Mars', 'Rahu', 'Ketu', 'Sun'].indexOf(p.name) >= 0;
        });
      },
      text: 'A difficult planet sits in a difficult house — the classical reversal. Your rise comes precisely through the situations that would break other people.' }
  ];

  var MANGAL_HOUSES = [1, 2, 4, 7, 8, 12];

  g.JyotishData = {
    HOUSES: HOUSES, PLANET_INFO: PLANET_INFO, PLANET_HOUSE: PLANET_HOUSE,
    NAK_TRAITS: NAK_TRAITS, RASHI_TRAITS: RASHI_TRAITS,
    DASHA_EFFECT: DASHA_EFFECT, YOGAS: YOGAS, MANGAL_HOUSES: MANGAL_HOUSES
  };
})(window);
