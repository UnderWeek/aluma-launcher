const SITE_TEXT = {
  en: {
    navFeatures: 'Features',
    navProject: 'Project',
    status: 'Independent launcher · In development',
    heroLine1: 'A home for your',
    heroLine2: 'Minecraft worlds.',
    intro: 'Different versions. Different mods. Your own space for every adventure. Meet Aluma, a simple launcher for Minecraft: Java Edition.',
    explore: 'Explore the project',
    takeLook: 'Take a look ↓',
    platforms: 'Built with Electron · Windows, macOS & Linux targets',
    caption1: 'A little momentum.',
    caption2: 'A new adventure.',
    inside: 'Inside Aluma',
    previewStatus: 'Development preview / demo instance',
    featuresEyebrow: 'Room to make it yours',
    featuresLine1: 'One launcher.',
    featuresLine2: 'Many ways to play.',
    instancesNumber: '01 / INSTANCES',
    instancesTitle: 'Keep worlds separate.',
    instancesBody: 'Give each instance its own mods, saves, and settings. Switch between Minecraft versions without mixing your files.',
    modsNumber: '02 / MODDING',
    modsTitle: 'Find your next favourite.',
    modsBody: 'Start with Vanilla or Fabric. Browse Modrinth and CurseForge, install mods, and manage them from the launcher.',
    settingsNumber: '03 / YOUR SPACE',
    settingsTitle: 'Feel at home.',
    settingsBody: 'Choose light or dark mode, your accent colour, language, and game settings. User data stays together in your .aluma folder.',
    projectEyebrow: 'Made in the open',
    projectLine1: 'A small project.',
    projectLine2: 'A clear direction.',
    authorPrefix: 'Aluma Launcher is developed by',
    authorSuffix: '. The source code is public, and feedback is welcome.',
    development: 'Aluma is currently in development. Packaged downloads are not available yet. Microsoft account sign-in is implemented; Minecraft Services API approval is pending before online account access can work.',
    authentication: 'Authentication takes place on Microsoft\'s sign-in page. Aluma uses the resulting tokens to request the Minecraft profile and launch the game; it does not collect your Microsoft password.',
    source: 'Source code ↗',
    contact: 'Contact & feedback ↗',
    footerTagline: 'Built for the next adventure.',
    disclaimer: 'Not an official Minecraft product. Not affiliated with or approved by Mojang or Microsoft. Minecraft is a trademark of its respective owners.',
    navigation: 'Main navigation',
    language: 'Site language',
    previewLabel: 'Launcher preview',
    screenshotAlt: 'Aluma Launcher dark interface showing a demo Vanilla Minecraft instance, Play button, and navigation for instances, mods, accounts, and settings.',
    title: 'Aluma Launcher — A home for your Minecraft worlds',
    description: 'Aluma Launcher is an independent Minecraft: Java Edition launcher with separate instances, Fabric support, and mod browsing. Currently in development.'
  },
  ru: {
    navigation: 'Навигация по сайту',
    language: 'Язык сайта',
    navFeatures: 'Возможности',
    navProject: 'О проекте',
    status: 'Независимый лаунчер · В разработке',
    heroLine1: 'Твой дом для',
    heroLine2: 'миров Minecraft.',
    intro: 'Разные версии. Разные моды. Своя сборка для каждого приключения. Знакомься с Aluma — простым лаунчером Minecraft: Java Edition.',
    explore: 'Открыть проект',
    takeLook: 'Посмотреть ↓',
    platforms: 'На Electron · Разрабатывается для Windows, macOS и Linux',
    caption1: 'Немного разгона.',
    caption2: 'Новое приключение.',
    previewLabel: 'Предпросмотр лаунчера',
    inside: 'Внутри Aluma',
    previewStatus: 'Версия в разработке / демонстрационная сборка',
    screenshotAlt: 'Тёмный интерфейс Aluma Launcher: демонстрационная сборка Vanilla Minecraft, кнопка запуска и разделы сборок, модов, аккаунтов и настроек.',
    featuresEyebrow: 'Пространство для твоих идей',
    featuresLine1: 'Один лаунчер.',
    featuresLine2: 'Много способов играть.',
    instancesNumber: '01 / СБОРКИ',
    instancesTitle: 'Каждому миру — своё место.',
    instancesBody: 'У каждой сборки свои моды, сохранения и настройки. Переключайся между версиями Minecraft, не смешивая файлы.',
    modsNumber: '02 / МОДЫ',
    modsTitle: 'Найди новый любимый мод.',
    modsBody: 'Начни с Vanilla или Fabric. Ищи моды на Modrinth и CurseForge, устанавливай их и управляй ими прямо в лаунчере.',
    settingsNumber: '03 / ТВОЁ ПРОСТРАНСТВО',
    settingsTitle: 'Устройся поудобнее.',
    settingsBody: 'Выбери светлую или тёмную тему, цвет интерфейса, язык и настройки игры. Пользовательские данные хранятся вместе в папке .aluma.',
    projectEyebrow: 'Открытая разработка',
    projectLine1: 'Небольшой проект.',
    projectLine2: 'Понятное направление.',
    authorPrefix: 'Aluma Launcher разрабатывает',
    authorSuffix: '. Исходный код открыт, а обратная связь всегда приветствуется.',
    development: 'Aluma пока в разработке. Готовых установочных пакетов ещё нет. Вход Microsoft реализован; для доступа к игровому аккаунту ожидается одобрение Minecraft Services API.',
    authentication: 'Авторизация проходит на странице входа Microsoft. Aluma использует полученные токены, чтобы запросить профиль Minecraft и запустить игру; пароль Microsoft лаунчер не собирает.',
    source: 'Исходный код ↗',
    contact: 'Связь и обратная связь ↗',
    footerTagline: 'Для следующего приключения.',
    disclaimer: 'Не является официальным продуктом Minecraft. Не связан с Mojang или Microsoft и не одобрен ими. Minecraft — товарный знак его владельцев.',
    title: 'Aluma Launcher — Дом для твоих миров Minecraft',
    description: 'Aluma Launcher — независимый лаунчер Minecraft: Java Edition с отдельными сборками, поддержкой Fabric и поиском модов. В разработке.'
  }
}
const SITE_LANGUAGE_KEY = 'aluma-site-language'

function browserLanguage() {
  for (const locale of navigator.languages || [navigator.language]) {
    const language = String(locale).toLowerCase().split('-')[0]
    if (SITE_TEXT[language]) return language
  }
  return 'en'
}

function applySiteLanguage(language) {
  const text = SITE_TEXT[language] || SITE_TEXT.en
  document.documentElement.lang = SITE_TEXT[language] ? language : 'en'
  document.title = text.title
  document.querySelector('meta[name="description"]').content = text.description
  document.querySelectorAll('[data-i18n]').forEach(element => {
    element.textContent = text[element.dataset.i18n]
  })
  for (const [attribute, dataset] of [['aria-label', 'i18nAria'], ['alt', 'i18nAlt']]) {
    const selector = attribute === 'alt' ? '[data-i18n-alt]' : '[data-i18n-aria]'
    document.querySelectorAll(selector).forEach(element => {
      element.setAttribute(attribute, text[element.dataset[dataset]])
    })
  }
  document.querySelector('#siteLanguage').value = document.documentElement.lang
}

let savedLanguage
try { savedLanguage = localStorage.getItem(SITE_LANGUAGE_KEY) } catch {}
applySiteLanguage(SITE_TEXT[savedLanguage] ? savedLanguage : browserLanguage())
document.querySelector('#siteLanguage').addEventListener('change', event => {
  const language = event.target.value
  applySiteLanguage(language)
  try { localStorage.setItem(SITE_LANGUAGE_KEY, language) } catch {}
})
