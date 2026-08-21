(() => {
  const machine = document.querySelector('.translation-machine');
  const title = document.querySelector('[data-language-title]');
  if (!machine) return;

  const nodes = [...machine.querySelectorAll('.language-node')];
  const processCopy = machine.querySelector('.sentence-process p');
  const processLanguage = machine.querySelector('.process-language');
  const translations = [
    ['Nta cyiza cyangwa ikibi kiri ku isi, ni uko dutekereza gusa.', '#D0443E', 'Kinyarwanda'],
    ['Pe tye gin mo maber onyo marac i lobo, tye tam wa keken.', '#D46345', 'Acholi'],
    ['په نړۍ کې هیڅ سم یا غلط نشته، یوازې زموږ فکرونه دي.', '#CF8F32', 'Pashto'],
    ['Աշխարհում չկա ճիշտ կամ սխալ, միայն մեր մտքերն են։', '#D2902F', 'Armenian'],
    ['אין נכון או לא נכון בעולם, רק המחשבות שלנו', '#A5B033', 'Hebrew'],
    ['Maailmassa ei ole oikeaa tai väärää, vain mielemme', '#7CA745', 'Finnish'],
    ['دۇنيادا توغرا ياكى خاتا يوق، پەقەت بىزنىڭ ئەقلىمىزلا بار', '#58A79D', 'Uyghur'],
    ['འཇིག་རྟེན་འདིར་ཡང་དག་དང་ནོར་འཁྲུལ་མེད་པར་བསམ་བློ་གཏོང་སྟངས་མི་འདྲ་བ་ཁོ་ན་ཡོད།', '#7CAFBB', 'Tibetan'],
    ['လောကမှာ မှန်တာမှားတာ မရှိဘူး၊ ကျွန်ုပ်တို့ရဲ့စိတ်ပဲရှိတယ်', '#6583BC', 'Burmese'],
    ['ʻAʻohe pono a hewa paha ma ke ao nei, ʻo ko kākou mau manaʻo wale nō.', '#BB82AF', 'Hawaiian'],
    ['Walang tama o mali sa mundo, tanging ang ating mga iniisip lamang.', '#99599D', 'Filipino'],
    ['Kay pachaqa hukniraymi yuyaykushan, manan allinchu nitaq mana allinchu.', '#D93682', 'Quechua']
  ];
  const titleSteps = ['BABEL', 'バベル', 'papelu', 'ባቤል', '바벨', 'ပႃႇပႄႇလ်', 'Babela', 'ᱵᱮᱵᱮᱞ', 'ᐹᐳᓪ', 'ਬਾਬਲ', 'бавел', 'બેબેલ', 'ބާބެލް އެވެ', '巴别塔', 'բաբելոն', 'בבל', 'Βαβέλ', 'བཱ་བེལ།', 'บาเบล', 'ບາເບວ', 'බාබෙල්','巴別塔','بابل','បាបែល','பாபெல்'];
  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const setActiveNode = (activeIndex, color = '#171513') => {
    nodes.forEach((node, index) => {
      node.classList.toggle('active', index === activeIndex);
      node.style.setProperty('--node-color', color);
    });
    machine.style.setProperty('--machine-accent', color);
  };

  const showProcess = (text, color, language) => {
    if (!processCopy) return;
    processCopy.textContent = text;
    processCopy.style.color = color;
    if (processLanguage) {
      processLanguage.textContent = language;
      processLanguage.style.color = color;
    }
    machine.classList.add('has-process');
  };

  const runCycle = async () => {
    while (true) {
      machine.classList.remove('has-output', 'has-process');
      setActiveNode(-1);
      await wait(450);

      machine.classList.add('has-input');
      await wait(2000);

      for (let index = 0; index < translations.length; index += 1) {
        const [text, color, language] = translations[index];
        setActiveNode(index, color);
        showProcess(text, color, language);
        await wait(2000);
        machine.classList.remove('has-process');
        await wait(600);
      }

      setActiveNode(-1);
      machine.classList.add('has-output');
      await wait(8000);

      machine.classList.remove('has-input', 'has-output');
      await wait(650);
    }
  };

  const runTitle = () => {
    if (!title || reducedMotion) return;
    let index = 0;
    window.setInterval(() => {
      index = (index + 1) % titleSteps.length;
      title.classList.add('is-changing');
      window.setTimeout(() => {
        title.textContent = titleSteps[index];
        title.classList.remove('is-changing');
      }, 180);
    }, 2550);
  };

  machine.classList.add('is-visible');
  if (reducedMotion) {
    machine.classList.add('has-input', 'has-process');
    setActiveNode(0, translations[0][1]);
    showProcess(translations[0][0], translations[0][1], translations[0][2]);
  } else {
    runCycle();
    runTitle();
  }
})();
