/**
 * Shaharlar ma'lumotnomasi (18.11.2026): tashish manzili "Shahar (Davlat)" ko'rinishida yoziladi, masalan
 * "Toshkent (Uzbekistan)". Shahar o'zbekcha, ruscha yoki inglizcha yozilsa ham taniladi va bir xil nomga keltiriladi.
 * Ma'lumotnomada yo'q shahar — foydalanuvchi davlatni qavsda o'zi yozadi.
 *
 * Format: davlat → "Asosiy nom/sinonim/sinonim;Keyingi shahar/...". Sinonimlar faqat qidiruv uchun.
 * Bu modul brauzerda ham ishlaydi (forma), shuning uchun server-only emas.
 */
const DATA: Record<string, string> = {
  Uzbekistan:
    "Toshkent/Tashkent/Ташкент/Тошкент;Samarqand/Samarkand/Самарканд/Самарқанд;Buxoro/Bukhara/Buhara/Бухара/Бухоро;" +
    "Andijon/Andijan/Андижан/Андижон;Farg'ona/Fergana/Ferghana/Фергана/Фарғона;Namangan/Наманган;Qo'qon/Kokand/Коканд/Қўқон;" +
    "Marg'ilon/Margilan/Маргилан;Nukus/Нукус;Urganch/Urgench/Ургенч/Урганч;Xiva/Khiva/Хива;Qarshi/Karshi/Карши/Қарши;" +
    "Termiz/Termez/Термез/Термиз;Navoiy/Navoi/Навои/Навоий;Jizzax/Jizzakh/Джизак/Жиззах;Guliston/Gulistan/Гулистан;" +
    "Angren/Ангрен;Olmaliq/Almalyk/Алмалык;Chirchiq/Chirchik/Чирчик;Bekobod/Bekabad/Бекабад;Zarafshon/Zarafshan/Зарафшан;" +
    "Shahrisabz/Shakhrisabz/Шахрисабз;Denov/Denau/Денау;Chuqursoy/Chukursay/Чукурсай;Sirdaryo/Syrdarya/Сырдарья;" +
    "Yangiyo'l/Yangiyul/Янгиюль;Ohangaron/Akhangaran/Ахангаран;Qo'ng'irot/Kungrad/Кунград;Beruniy/Beruni/Беруни;" +
    "To'rtko'l/Turtkul/Турткуль;Xo'jayli/Khodjeyli/Ходжейли;G'uzor/Guzar/Гузар;Kitob/Kitab/Китаб;Kattaqo'rg'on/Kattakurgan/Каттакурган;" +
    "Urgut/Ургут;Asaka/Асака;Xonobod/Khanabad/Ханабад;Chust/Чуст;Kosonsoy/Kasansay/Касансай;Uchqo'rg'on/Uchkurgan/Учкурган;" +
    "Quvasoy/Kuvasay/Кувасай;Rishton/Rishtan/Риштан;Oltiariq/Altyaryk/Алтыарык;G'ijduvon/Gijduvan/Гиждуван;Kogon/Kagan/Каган;" +
    "Olot/Alat/Алат;Qorako'l/Karakul/Каракуль;Uchquduq/Uchkuduk/Учкудук;Zomin/Zaamin/Заамин;Yallama/Ялама;Keles/Келес;" +
    "Dashtobod/Dashtabad/Даштабад;Xazorasp/Khazarasp/Хазарасп;Sariosiyo/Sariasiya/Сариасия;Sherobod/Sherabad/Шерабад;" +
    "Muborak/Mubarek/Мубарек;Nurota/Nurata/Нурата;Paxtakor/Pakhtakor/Пахтакор;Yangiyer/Янгиер;Shirin/Ширин",
  Kazakhstan:
    "Almati/Almaty/Alma-Ata/Алматы/Алма-Ата/Олмаота;Astana/Nur-Sultan/Астана/Нур-Султан;Shimkent/Shymkent/Chimkent/Шымкент/Чимкент;" +
    "Turkiston/Turkestan/Туркестан;Taraz/Тараз/Jambul;Qizilo'rda/Kyzylorda/Кызылорда;Aqto'be/Aktobe/Актобе/Актюбинск;" +
    "Atirau/Atyrau/Атырау;Aqtau/Aktau/Актау;Uralsk/Oral/Уральск/Орал;Qarag'anda/Karaganda/Караганда;Pavlodar/Павлодар;" +
    "Semey/Semipalatinsk/Семей/Семипалатинск;Oskemen/Ust-Kamenogorsk/Усть-Каменогорск/Өскемен;Kostanay/Qostanay/Костанай;" +
    "Petropavl/Petropavlovsk/Петропавловск;Kokshetau/Кокшетау;Taldiqo'rg'on/Taldykorgan/Талдыкорган;Jarkent/Zharkent/Жаркент;" +
    "Xorgos/Khorgos/Khorgas/Хоргос;Saryagash/Сарыагаш;Jetisay/Zhetysay/Жетысай;Beyneu/Бейнеу;Ekibastuz/Экибастуз;Kentau/Кентау",
  Kyrgyzstan:
    "Bishkek/Бишкек;O'sh/Osh/Ош;Jalolobod/Jalal-Abad/Джалал-Абад;Karakol/Каракол;Tokmok/Токмок;" +
    "Botken/Batken/Баткен;Norin/Naryn/Нарын;Talas/Талас;Uzgen/O'zgan/Узген;Kara-Balta/Карабалта;Torugart/Торугарт;Irkeshtam/Иркештам",
  Tajikistan:
    "Dushanbe/Душанбе;Xo'jand/Khujand/Худжанд;Kulob/Kulyab/Куляб;Qo'rg'ontepa/Bokhtar/Bohtar/Бохтар/Курган-Тюбе;" +
    "Istaravshan/Истаравшан;Panjakent/Penjikent/Пенджикент;Konibodom/Kanibadam/Канибадам;Isfara/Исфара;Tursunzoda/Tursunzade/Турсунзаде;" +
    "Xorog'/Khorog/Хорог;Vahdat/Вахдат",
  Turkmenistan:
    "Ashxobod/Ashgabat/Ашхабад;Turkmanobod/Turkmenabat/Chardjou/Туркменабат/Чарджоу;Dashoguz/Dashhowuz/Дашогуз;Mari/Mary/Мары;" +
    "Turkmanboshi/Turkmenbashi/Туркменбаши;Balkanabat/Балканабат;Farab/Фараб",
  Afghanistan:
    "Kobul/Kabul/Кабул;Mozori Sharif/Mazar-i-Sharif/Мазари-Шариф;Hirot/Herat/Герат;Qandahor/Kandahar/Кандагар;Hayraton/Hairatan/Хайратон;" +
    "Qunduz/Kunduz/Кундуз;Jalalabad/Джелалабад;Shibirg'on/Sheberghan/Шибирган;Torg'undi/Torghundi/Торгунди",
  Russia:
    "Moskva/Moscow/Москва;Sankt-Peterburg/Saint Petersburg/St Petersburg/Санкт-Петербург/Питер;Novosibirsk/Новосибирск;" +
    "Yekaterinburg/Ekaterinburg/Екатеринбург;Qozon/Kazan/Казань;Nijniy Novgorod/Nizhny Novgorod/Нижний Новгород;Chelyabinsk/Челябинск;" +
    "Samara/Самара;Omsk/Омск;Rostov-na-Donu/Rostov-on-Don/Rostov/Ростов-на-Дону/Ростов;Ufa/Уфа;Krasnoyarsk/Красноярск;" +
    "Voronej/Voronezh/Воронеж;Perm/Пермь;Volgograd/Волгоград;Krasnodar/Краснодар;Saratov/Саратов;Tyumen/Тюмень;" +
    "Tolyatti/Togliatti/Тольятти;Ijevsk/Izhevsk/Ижевск;Barnaul/Барнаул;Ulyanovsk/Ульяновск;Irkutsk/Иркутск;Xabarovsk/Khabarovsk/Хабаровск;" +
    "Yaroslavl/Ярославль;Vladivostok/Владивосток;Maxachqal'a/Makhachkala/Махачкала;Tomsk/Томск;Orenburg/Оренбург;Kemerovo/Кемерово;" +
    "Novokuznetsk/Новокузнецк;Ryazan/Рязань;Astraxan/Astrakhan/Астрахань;Penza/Пенза;Lipetsk/Липецк;Kirov/Киров;Tula/Тула;" +
    "Kaliningrad/Калининград;Kursk/Курск;Stavropol/Ставрополь;Tver/Тверь;Belgorod/Белгород;Smolensk/Смоленск;Bryansk/Брянск;" +
    "Kaluga/Калуга;Vladimir/Владимир;Ivanovo/Иваново;Surgut/Сургут;Murmansk/Мурманск;Arxangelsk/Arkhangelsk/Архангельск;" +
    "Kurgan/Курган;Magnitogorsk/Магнитогорск;Naberejnie Chelni/Naberezhnye Chelny/Набережные Челны;Sochi/Сочи;Novorossiysk/Новороссийск;" +
    "Podolsk/Подольск;Lyubertsy/Люберцы;Domodedovo/Домодедово;Mytishchi/Мытищи;Khimki/Химки;Balashikha/Балашиха;Elektrostal/Электросталь;" +
    "Orsk/Орск;Troitsk/Троицк;Petropavlovsk-Kamchatsky/Петропавловск-Камчатский;Chita/Чита;Ulan-Ude/Улан-Удэ;Blagoveshchensk/Благовещенск;" +
    "Zabaykalsk/Забайкальск;Rubtsovsk/Рубцовск;Biysk/Бийск;Cheboksary/Чебоксары;Saransk/Саранск;Yoshkar-Ola/Йошкар-Ола;" +
    "Vologda/Вологда;Cherepovets/Череповец;Petrozavodsk/Петрозаводск;Pskov/Псков;Velikiy Novgorod/Великий Новгород;Oryol/Orel/Орёл/Орел;" +
    "Tambov/Тамбов;Grozniy/Grozny/Грозный;Vladikavkaz/Владикавказ;Nalchik/Нальчик;Mineralnye Vody/Минеральные Воды;Taganrog/Таганрог;" +
    "Shaxti/Shakhty/Шахты;Volzhsky/Волжский;Syzran/Сызрань;Sterlitamak/Стерлитамак;Nizhnevartovsk/Нижневартовск;Noyabrsk/Ноябрьск;" +
    "Novy Urengoy/Новый Уренгой;Yakutsk/Якутск;Norilsk/Норильск;Iskitim/Искитим;Bataysk/Батайск",
  Belarus:
    "Minsk/Минск;Brest/Брест;Grodno/Hrodna/Гродно;Gomel/Homel/Гомель;Vitebsk/Витебск;Mogilev/Mahilyow/Могилёв/Могилев;" +
    "Bobruisk/Бобруйск;Baranovichi/Барановичи;Borisov/Борисов;Pinsk/Пинск;Orsha/Орша;Lida/Лида;Molodechno/Молодечно;Kozlovichi/Козловичи",
  Ukraine:
    "Kiyev/Kyiv/Kiev/Киев/Київ;Xarkov/Kharkiv/Kharkov/Харьков;Odessa/Odesa/Одесса;Dnepr/Dnipro/Днепр;Lvov/Lviv/Львов;" +
    "Zaporojye/Zaporizhzhia/Запорожье;Vinnitsa/Vinnytsia/Винница;Poltava/Полтава;Chernigov/Chernihiv/Чернигов;Rovno/Rivne/Ровно;" +
    "Lutsk/Луцк;Uzhgorod/Uzhhorod/Ужгород;Chop/Чоп;Kovel/Ковель",
  Moldova: "Kishinyov/Chisinau/Кишинёв/Кишинев;Balti/Бельцы",
  Poland:
    "Varshava/Warsaw/Warszawa/Варшава;Krakov/Krakow/Kraków/Краков;Lodz/Łódź/Лодзь;Vrotslav/Wroclaw/Wrocław/Вроцлав;" +
    "Poznan/Poznań/Познань;Gdansk/Gdańsk/Гданьск;Shchetsin/Szczecin/Щецин;Bydgoshch/Bydgoszcz/Быдгощ;Lyublin/Lublin/Люблин;" +
    "Belostok/Bialystok/Białystok/Белосток;Katovitse/Katowice/Катовице;Gdynia/Gdynya/Гдыня;Chenstochova/Czestochowa/Częstochowa/Ченстохова;" +
    "Radom/Радом;Rzeszow/Rzeszów/Жешув;Torun/Toruń/Торунь;Kielce/Кельце;Olsztyn/Ольштын;Opole/Ополе;Gliwice/Гливице;" +
    "Terespol/Тересполь;Malaszewicze/Małaszewicze/Малашевиче;Kukuryki/Кукурыки;Koroszczyn/Корощин;Bobrowniki/Бобровники;" +
    "Kuznica/Kuźnica/Кузница;Stryków/Strykow/Стрыков;Piotrków Trybunalski/Пётркув-Трыбунальски;Sosnowiec/Сосновец;Biała Podlaska/Бяла-Подляска",
  Lithuania: "Vilnyus/Vilnius/Вильнюс;Kaunas/Каунас;Klaypeda/Klaipeda/Klaipėda/Клайпеда;Shyaulyay/Siauliai/Šiauliai/Шяуляй;Panevezys/Panevėžys/Паневежис;Medininkai/Мядининкай",
  Latvia: "Riga/Рига;Daugavpils/Даугавпилс;Liepaja/Liepāja/Лиепая;Ventspils/Вентспилс;Rezekne/Rēzekne/Резекне",
  Estonia: "Tallin/Tallinn/Таллин;Tartu/Тарту;Narva/Нарва",
  Finland: "Xelsinki/Helsinki/Хельсинки;Kotka/Котка;Vaalimaa/Ваалимаа",
  Germany:
    "Berlin/Берлин;Gamburg/Hamburg/Гамбург;Myunxen/Munich/München/Мюнхен;Kyoln/Cologne/Köln/Кёльн/Кельн;Frankfurt/Франкфурт;" +
    "Shtutgart/Stuttgart/Штутгарт;Dyusseldorf/Düsseldorf/Дюссельдорф;Leyptsig/Leipzig/Лейпциг;Dortmund/Дортмунд;Essen/Эссен;" +
    "Bremen/Бремен;Drezden/Dresden/Дрезден;Gannover/Hannover/Ганновер;Nyurnberg/Nuremberg/Nürnberg/Нюрнберг;Duisburg/Дуйсбург;" +
    "Frankfurt-na-Odere/Frankfurt (Oder)/Франкфурт-на-Одере;Bremerhaven/Бремерхафен",
  Netherlands: "Amsterdam/Амстердам;Rotterdam/Роттердам;Gaaga/The Hague/Den Haag/Гаага;Utrecht/Утрехт;Eyndxoven/Eindhoven/Эйндховен;Venlo/Венло",
  Belgium: "Bryussel/Brussels/Bruxelles/Брюссель;Antverpen/Antwerp/Антверпен;Gent/Ghent/Гент;Lyej/Liège/Liege/Льеж",
  France: "Parij/Paris/Париж;Marsel/Marseille/Марсель;Lion/Lyon/Лион;Tuluza/Toulouse/Тулуза;Lill/Lille/Лилль;Strasburg/Strasbourg/Страсбург;Le Avr/Le Havre/Гавр",
  Italy: "Rim/Rome/Roma/Рим;Milan/Milano/Милан;Turin/Torino/Турин;Neapol/Naples/Napoli/Неаполь;Genuya/Genoa/Genova/Генуя;Venetsiya/Venice/Venezia/Венеция;Bolonya/Bologna/Болонья;Verona/Верона",
  Spain: "Madrid/Мадрид;Barselona/Barcelona/Барселона;Valensiya/Valencia/Валенсия;Sevilya/Seville/Sevilla/Севилья;Saragosa/Zaragoza/Сарагоса",
  Portugal: "Lissabon/Lisbon/Lisboa/Лиссабон;Porto/Порту",
  Austria: "Vena/Vienna/Wien/Вена;Graz/Грац;Linz/Линц;Zalsburg/Salzburg/Зальцбург",
  Switzerland: "Syurix/Zurich/Zürich/Цюрих;Jeneva/Geneva/Genève/Женева;Bazel/Basel/Базель;Bern/Берн",
  Czechia: "Praga/Prague/Praha/Прага;Brno/Брно;Ostrava/Острава;Plzen/Plzeň/Пльзень",
  Slovakia: "Bratislava/Братислава;Koshitse/Kosice/Košice/Кошице;Zhilina/Žilina/Жилина",
  Hungary: "Budapesht/Budapest/Будапешт;Debretsen/Debrecen/Дебрецен;Segedd/Szeged/Сегед;Zahony/Záhony/Захонь",
  Slovenia: "Lyublyana/Ljubljana/Любляна;Koper/Копер",
  Croatia: "Zagreb/Загреб;Rieka/Rijeka/Риека",
  Serbia: "Belgrad/Belgrade/Beograd/Белград;Novi Sad/Нови-Сад;Nish/Niš/Ниш",
  Romania: "Buxarest/Bucharest/București/Бухарест;Konstansa/Constanța/Constanta/Констанца;Kluj-Napoka/Cluj-Napoca/Клуж-Напока;Timishoara/Timișoara/Тимишоара",
  Bulgaria: "Sofiya/Sofia/София;Plovdiv/Пловдив;Varna/Варна;Burgas/Бургас;Ruse/Русе",
  Greece: "Afina/Athens/Афины;Saloniki/Thessaloniki/Салоники",
  Turkey:
    "Istanbul/İstanbul/Стамбул;Anqara/Ankara/Анкара;Izmir/İzmir/Измир;Bursa/Бурса;Antaliya/Antalya/Анталья;Adana/Адана;" +
    "Konya/Конья;G'aziantep/Gaziantep/Газиантеп;Mersin/Мерсин;Kayseri/Кайсери;Trabzon/Трабзон;Samsun/Самсун;Erzurum/Эрзурум;" +
    "Denizli/Денизли;Eskishehir/Eskişehir/Эскишехир;Kocaeli/Izmit/Коджаэли;Sarp/Сарп;Kapikule/Kapıkule/Капыкуле;Gurbulak/Gürbulak/Гюрбулак",
  Georgia: "Tbilisi/Тбилиси;Batumi/Батуми;Kutaisi/Кутаиси;Poti/Поти;Rustavi/Рустави;Verxniy Lars/Upper Lars/Верхний Ларс",
  Azerbaijan: "Boku/Baku/Баку;Ganja/Гянджа;Sumgait/Сумгаит;Alyat/Алят;Krasniy Most/Qirmizi Korpu/Красный Мост",
  Armenia: "Yerevan/Ереван;Gyumri/Гюмри",
  Iran: "Tehron/Tehran/Тегеран;Mashhad/Мешхед;Tabriz/Тебриз;Isfahon/Isfahan/Исфахан;Bandar Abbos/Bandar Abbas/Бендер-Аббас;Sarax/Sarakhs/Серахс;Inche Burun/Incheh Borun/Инчебурун",
  China:
    "Pekin/Beijing/Пекин;Shanxay/Shanghai/Шанхай;Urumchi/Urumqi/Урумчи;Qashqar/Kashgar/Kashi/Кашгар;Guanchjou/Guangzhou/Гуанчжоу;" +
    "Shenchjen/Shenzhen/Шэньчжэнь;Tyanszin/Tianjin/Тяньцзинь;Chunsin/Chongqing/Чунцин;Chendu/Chengdu/Чэнду;Uxan/Wuhan/Ухань;" +
    "Sian/Xi'an/Xian/Сиань;Lanchjou/Lanzhou/Ланьчжоу;Chjenchjou/Zhengzhou/Чжэнчжоу;Ivu/Yiwu/Иу;Horgos/Хоргос КНР;" +
    "Alashankou/Алашанькоу;Nankin/Nanjing/Нанкин;Xanchjou/Hangzhou/Ханчжоу;Sinin/Xining/Синин;" +
    "Tsindao/Qingdao/Циндао;Shiszyachjuan/Shijiazhuang/Шицзячжуан;Xarbin/Harbin/Харбин;Manchjuriya/Manzhouli/Маньчжурия;Erlyan/Erenhot/Эрлянь;" +
    "Baotou/Баотоу;Inchuan/Yinchuan/Иньчуань;Kuytun/Kuytun/Куйтун;Gulja/Yining/Кульджа/Инин",
  Mongolia: "Ulan-Bator/Ulaanbaatar/Улан-Батор;Zamin-Uud/Замын-Ууд",
  Pakistan: "Karachi/Карачи;Lahor/Lahore/Лахор;Islomobod/Islamabad/Исламабад;Peshovar/Peshawar/Пешавар",
  India: "Dehli/Delhi/New Delhi/Дели;Mumbay/Mumbai/Мумбаи",
  UAE: "Dubay/Dubai/Дубай;Abu-Dabi/Abu Dhabi/Абу-Даби;Sharja/Sharjah/Шарджа;Jabal Ali/Jebel Ali/Джебель-Али",
  "Saudi Arabia": "Ar-Riyod/Riyadh/Эр-Рияд;Jidda/Jeddah/Джидда",
  Sweden: "Stokgolm/Stockholm/Стокгольм;Gyoteborg/Gothenburg/Göteborg/Гётеборг",
  Denmark: "Kopengagen/Copenhagen/København/Копенгаген",
  Norway: "Oslo/Осло",
  "United Kingdom": "London/Лондон;Manchester/Манчестер",
};

export type KnownPlace = { city: string; country: string; aliases: string[] };

/** Qidiruv kaliti: kichik harf, tutuq belgilari va bo'shliqlarsiz, ё → е. */
export function placeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[ʻʼ'’`‘´-]/g, "")
    .replace(/\s+/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l");
}

let cache: { list: KnownPlace[]; byKey: Map<string, KnownPlace> } | null = null;

function index() {
  if (cache) return cache;
  const list: KnownPlace[] = [];
  const byKey = new Map<string, KnownPlace>();
  for (const [country, cities] of Object.entries(DATA)) {
    for (const entry of cities.split(";")) {
      const [city, ...aliases] = entry.split("/").map((x) => x.trim()).filter(Boolean);
      const p: KnownPlace = { city, country, aliases };
      list.push(p);
      for (const name of [city, ...aliases]) {
        const k = placeKey(name);
        if (!byKey.has(k)) byKey.set(k, p);
      }
    }
  }
  cache = { list, byKey };
  return cache;
}

export function knownPlaces(): KnownPlace[] {
  return index().list;
}

export function placeLabel(p: KnownPlace): string {
  return `${p.city} (${p.country})`;
}

/**
 * Manzilni "Shahar (Davlat)" ko'rinishiga keltiradi.
 * - Qavsda davlat yozilgan bo'lsa — faqat bo'shliqlar tartiblanadi ("Toshkent(Uzbekistan)" → "Toshkent (Uzbekistan)").
 * - Shahar ma'lumotnomada bo'lsa — asosiy nom va davlat qo'shiladi ("Tashkent" → "Toshkent (Uzbekistan)").
 * - Aks holda o'zgarmaydi.
 */
export function formatPlace(input: string): string {
  const s = input.replace(/\s+/g, " ").trim();
  if (!s) return s;
  const m = s.match(/^(.*?)\s*\(\s*(.+?)\s*\)\s*$/);
  if (m) {
    const known = index().byKey.get(placeKey(m[1]));
    // "Tashkent (uzbekistan)" — davlat nomini ham ma'lumotnomadagi ko'rinishga keltiramiz.
    if (known && placeKey(m[2]) === placeKey(known.country)) return placeLabel(known);
    return `${m[1]} (${m[2]})`;
  }
  const known = index().byKey.get(placeKey(s));
  return known ? placeLabel(known) : s;
}

/** Davlat ko'rsatilganmi (qavsda) yoki shahar ma'lumotnomadami. */
export function hasCountry(input: string): boolean {
  return /\(.+\)\s*$/.test(formatPlace(input));
}
