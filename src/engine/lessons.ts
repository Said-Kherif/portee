import type { IScore } from '../score/layout'
import type { Accidental, Clef, KeyId } from './notes'
import type { IElement, IMeasure } from './rhythm'
import { assignLine } from './rhythm'

export interface ILessonStep {
  title: string
  text: string[]
  score?: IScore
  names?: boolean
  labels?: Record<number, string>
  accent?: number[]
  quiz?: boolean
  piano?: { low: number; high: number; marks: number[] }
}

export interface ILesson {
  levelId: string
  steps: ILessonStep[]
}

interface INoteSpec {
  clef: Clef
  d: number
  shown?: Accidental | null
}

function pitches(system: IScore['system'], items: INoteSpec[], key: KeyId = 'C', beatWidth = 3.4): IScore {
  return {
    system,
    key,
    timeSig: null,
    barlines: false,
    beatWidth,
    measures: [
      {
        elements: items.map((n, i) => ({ kind: 'note', value: 'w', dots: 0, beats: 1, start: i, clef: n.clef, diatonic: n.d, shown: n.shown ?? null })),
      },
    ],
  }
}

function rhythm(measures: IMeasure[]): IScore {
  return { system: 'rhythm', key: 'C', timeSig: [4, 4], barlines: true, measures: assignLine(measures) }
}

const q = (start: number, dots: 0 | 1 = 0): IElement => ({ kind: 'note', value: 'q', dots, beats: dots ? 1.5 : 1, start })
const h = (start: number, dots: 0 | 1 = 0): IElement => ({ kind: 'note', value: 'h', dots, beats: dots ? 3 : 2, start })
const w = (start: number): IElement => ({ kind: 'note', value: 'w', dots: 0, beats: 4, start })
const e = (start: number, beam?: number): IElement => ({ kind: 'note', value: 'e', dots: 0, beats: 0.5, start, beam })
const rq = (start: number): IElement => ({ kind: 'rest', value: 'q', dots: 0, beats: 1, start })
const rh = (start: number): IElement => ({ kind: 'rest', value: 'h', dots: 0, beats: 2, start })
const rw = (start: number): IElement => ({ kind: 'rest', value: 'w', dots: 0, beats: 4, start })
const n = (value: 'q' | 'h' | 'w', start: number, d: number, dots: 0 | 1 = 0, clef: Clef = 'treble'): IElement => ({ kind: 'note', value, dots, beats: { q: 1, h: 2, w: 4 }[value] * (dots ? 1.5 : 1), start, clef, diatonic: d, shown: null })
const ne = (start: number, d: number, beam?: number): IElement => ({ kind: 'note', value: 'e', dots: 0, beats: 0.5, start, beam, clef: 'treble', diatonic: d, shown: null })
const pause = (clef: Clef): IElement => ({ kind: 'rest', value: 'w', dots: 0, beats: 4, start: 0, clef })
const melody = (measures: IMeasure[], beatWidth?: number): IScore => ({ system: 'treble', key: 'C', timeSig: [4, 4], barlines: true, beatWidth, measures })
const grand = (measures: IMeasure[]): IScore => ({ system: 'grand', key: 'C', timeSig: [4, 4], barlines: true, measures })

const T = (d: number, shown?: Accidental | null): INoteSpec => ({ clef: 'treble', d, shown })
const B = (d: number, shown?: Accidental | null): INoteSpec => ({ clef: 'bass', d, shown })

export const LESSONS: ILesson[] = [
  {
    levelId: 'p1',
    steps: [
      {
        title: 'La portée',
        text: [
          'Cinq lignes, quatre interlignes. Une note est posée soit sur une ligne, soit dans un interligne, jamais entre les deux.',
          'Plus la note est haute sur la portée, plus la touche est à droite sur le clavier. Chaque ligne ou interligne correspond à une touche blanche. La clé, qui donne leur nom aux notes, arrive à l’étape suivante.',
        ],
        score: pitches('rhythm', [T(2), T(3), T(4), T(5), T(6)]),
        piano: { low: 60, high: 72, marks: [64, 65, 67, 69, 71] },
      },
      {
        title: 'Les deux clés',
        text: [
          'Le piano se lit sur deux portées reliées par une accolade. En haut la clé de sol, en général pour la main droite. En bas la clé de fa, pour la main gauche.',
          'La clé de sol s’enroule autour de la deuxième ligne : c’est le sol4. Les deux points de la clé de fa encadrent la quatrième ligne : c’est le fa3.',
        ],
        score: pitches('grand', [T(4), B(-4)]),
        names: true,
        piano: { low: 48, high: 72, marks: [67, 53] },
      },
      {
        title: 'Le do central',
        text: [
          'Le do central est la touche blanche juste à gauche des deux touches noires, au milieu du clavier. Le point bleu le marque sur le piano de l’application.',
          'Il s’écrit sur une petite ligne supplémentaire, juste sous la clé de sol ou juste au-dessus de la clé de fa. Deux écritures, une seule touche.',
        ],
        score: pitches('grand', [T(0), B(0)]),
        names: true,
        piano: { low: 48, high: 72, marks: [60] },
      },
      {
        title: 'Les do voisins',
        text: [
          'Deux autres repères : le do5, dans le troisième interligne de la clé de sol, et le do3, dans le deuxième interligne de la clé de fa.',
          'Avec le do central, le sol4 et le fa3, tu as cinq points d’ancrage répartis sur toute la grande portée.',
        ],
        score: pitches('grand', [B(-7), B(-4), T(0), T(4), T(7)]),
        names: true,
        accent: [0, 4],
        piano: { low: 48, high: 72, marks: [48, 53, 60, 67, 72] },
      },
      {
        title: 'La méthode',
        text: [
          'Ne compte pas les lignes depuis le bas. Pars du repère le plus proche et avance d’un cran par ligne ou interligne : un cran sur la portée, une touche blanche sur le clavier.',
          'L’entraînement affiche une note, tu joues la touche. D’abord juste, ensuite vite. Le palier est validé à 95\u00A0% de justesse avec un temps médian sous 1,5\u00A0seconde sur les 30 dernières notes.',
          'Si tu as un piano numérique, branche-le en USB et active-le dans les réglages, rubrique clavier MIDI : tu joues alors sur tes vraies touches.',
        ],
      },
    ],
  },
  {
    levelId: 'p2',
    steps: [
      {
        title: 'Les lignes de la clé de sol',
        text: [
          'De bas en haut : mi, sol, si, ré, fa. Le sol de la deuxième ligne est ton repère, les autres se trouvent en sautant une touche blanche à chaque ligne.',
        ],
        score: pitches('treble', [T(2), T(4), T(6), T(8), T(10)]),
        names: true,
        accent: [1],
        piano: { low: 60, high: 84, marks: [64, 67, 71, 74, 77] },
      },
      {
        title: 'Les interlignes',
        text: [
          'De bas en haut : fa, la, do, mi. Le do du troisième interligne est un repère. Lignes et interlignes alternent : mi sur la ligne, fa dans l’interligne, sol sur la ligne suivante.',
        ],
        score: pitches('treble', [T(3), T(5), T(7), T(9)]),
        names: true,
        accent: [2],
        piano: { low: 60, high: 84, marks: [65, 69, 72, 76] },
      },
      {
        title: 'Depuis les repères',
        text: [
          'Autour du sol4 : le fa juste en dessous, le la juste au-dessus. Autour du do5 : le si en dessous, le ré au-dessus. Tout le palier se lit ainsi, à un ou deux crans d’un repère.',
        ],
        score: pitches('treble', [T(3), T(4), T(5), T(6), T(7), T(8)]),
        names: true,
        accent: [1, 4],
        piano: { low: 60, high: 84, marks: [65, 67, 69, 71, 72, 74] },
      },
      {
        title: 'À l’envers',
        text: ['Une touche s’allume sur le clavier : montre sur la portée la note qui lui correspond. Les neuf notes du palier y passent, dans le désordre.'],
        score: pitches('treble', [T(2), T(3), T(4), T(5), T(6), T(7), T(8), T(9), T(10)], 'C', 2.6),
        quiz: true,
        piano: { low: 60, high: 84, marks: [] },
      },
    ],
  },
  {
    levelId: 'p3',
    steps: [
      {
        title: 'Les lignes de la clé de fa',
        text: [
          'De bas en haut : sol, si, ré, fa, la. Le fa de la quatrième ligne, entre les deux points de la clé, est ton repère principal.',
        ],
        score: pitches('bass', [B(-10), B(-8), B(-6), B(-4), B(-2)]),
        names: true,
        accent: [3],
        piano: { low: 36, high: 60, marks: [43, 47, 50, 53, 57] },
      },
      {
        title: 'Les interlignes',
        text: ['De bas en haut : la, do, mi, sol. Le do du deuxième interligne est le do3, une octave sous le do central.'],
        score: pitches('bass', [B(-9), B(-7), B(-5), B(-3)]),
        names: true,
        accent: [1],
        piano: { low: 36, high: 60, marks: [45, 48, 52, 55] },
      },
      {
        title: 'Depuis les repères',
        text: [
          'Autour du do3 : le si en dessous, le ré au-dessus. Autour du fa3 : le mi en dessous, le sol au-dessus. La clé de fa se lit exactement comme la clé de sol, seuls les repères changent.',
        ],
        score: pitches('bass', [B(-8), B(-7), B(-6), B(-5), B(-4), B(-3)]),
        names: true,
        accent: [1, 4],
        piano: { low: 36, high: 60, marks: [47, 48, 50, 52, 53, 55] },
      },
      {
        title: 'À l’envers',
        text: ['Une touche s’allume sur le clavier : montre sur la portée la note qui lui correspond. Les neuf notes du palier y passent, dans le désordre.'],
        score: pitches('bass', [B(-10), B(-9), B(-8), B(-7), B(-6), B(-5), B(-4), B(-3), B(-2)], 'C', 2.6),
        quiz: true,
        piano: { low: 36, high: 60, marks: [] },
      },
    ],
  },
  {
    levelId: 'p4',
    steps: [
      {
        title: 'Secondes et tierces',
        text: [
          'D’une ligne à l’interligne voisin, ou l’inverse, c’est une seconde : la touche blanche d’à côté. D’une ligne à la ligne suivante, ou d’un interligne au suivant, c’est une tierce : on saute une touche blanche.',
          'Compter les crans depuis un repère, c’est compter des secondes. Repérer une tierce d’un coup d’œil, ligne à ligne ou interligne à interligne, va deux fois plus vite.',
        ],
        score: pitches('treble', [T(4), T(5), T(4), T(6)]),
        names: true,
        accent: [1, 3],
        piano: { low: 60, high: 72, marks: [67, 69, 71] },
      },
      {
        title: 'La zone entre les portées',
        text: [
          'Entre les deux portées, les notes s’écrivent avec des lignes supplémentaires, soit sous la clé de sol, soit au-dessus de la clé de fa. Le compositeur choisit selon la main qui joue.',
          'Sous la clé de sol, en montant : la3 sur une deuxième ligne supplémentaire, si3 juste au-dessus, do4 sur la première ligne supplémentaire, ré4 collé sous la portée, puis mi4 sur la première ligne de la portée.',
        ],
        score: pitches('grand', [T(-2), T(-1), T(0), T(1), T(2)]),
        names: true,
        piano: { low: 48, high: 72, marks: [57, 59, 60, 62, 64] },
      },
      {
        title: 'Au-dessus de la clé de fa',
        text: [
          'Même principe vers le haut : si3 collé au-dessus de la cinquième ligne, do4 sur une ligne supplémentaire, ré4 au-dessus, mi4 sur une deuxième ligne.',
          'Le do central est toujours sur une ligne supplémentaire, dans les deux clés. C’est le pivot de toute cette zone.',
        ],
        score: pitches('grand', [B(-2), B(-1), B(0), B(1), B(2)]),
        names: true,
        piano: { low: 48, high: 72, marks: [57, 59, 60, 62, 64] },
      },
      {
        title: 'Lire en alternant',
        text: [
          'Ce palier mélange les deux clés. Réflexe en trois temps : quelle clé, quel repère le plus proche, combien de crans.',
          'Le même mi4 peut apparaître sur la première ligne de la clé de sol ou sur deux lignes supplémentaires au-dessus de la clé de fa. Même touche.',
        ],
        score: pitches('grand', [T(2), B(2), T(0), B(0)]),
        names: true,
        piano: { low: 48, high: 72, marks: [60, 64] },
      },
    ],
  },
  {
    levelId: 'p5',
    steps: [
      {
        title: 'Vers le haut',
        text: [
          'Au-dessus de la clé de sol : sol5 juste au-dessus de la cinquième ligne, la5 sur la première ligne supplémentaire, si5 au-dessus, do6 sur la deuxième.',
          'Repère : deux lignes supplémentaires au-dessus, c’est un do. Comme le do central en dessous.',
        ],
        score: pitches('treble', [T(10), T(11), T(12), T(13), T(14)]),
        names: true,
        accent: [4],
        piano: { low: 72, high: 84, marks: [77, 79, 81, 83, 84] },
      },
      {
        title: 'Vers le bas',
        text: [
          'Sous la clé de fa : fa2 collé sous la première ligne, mi2 sur la première ligne supplémentaire, ré2 en dessous, do2 sur la deuxième.',
          'Même symétrie : deux lignes supplémentaires en dessous de la clé de fa, c’est un do.',
        ],
        score: pitches('bass', [B(-14), B(-13), B(-12), B(-11), B(-10)]),
        names: true,
        accent: [0],
        piano: { low: 36, high: 48, marks: [36, 38, 40, 41, 43] },
      },
      {
        title: 'Compter les lignes',
        text: [
          'Pour une note loin de la portée, compte les lignes supplémentaires, pas les crans. Une ligne au-dessus de la clé de sol, la5. Deux lignes, do6. Une ligne sous la clé de fa, mi2. Deux lignes, do2.',
          'Puis regarde si la note est sur la ligne ou dans l’espace juste à côté.',
        ],
        score: pitches('grand', [T(12), T(14), B(-12), B(-14)]),
        names: true,
      },
    ],
  },
  {
    levelId: 'p6',
    steps: [
      {
        title: 'Dièse, bémol, bécarre',
        text: [
          'Le dièse ♯ monte la note d’un demi-ton : la touche immédiatement à droite, souvent noire. Le bémol ♭ la descend d’un demi-ton : la touche immédiatement à gauche.',
          'Le bécarre ♮ annule l’altération et ramène à la touche blanche. L’altération se place juste avant la note, sur la même ligne ou le même interligne.',
        ],
        score: pitches('treble', [T(3), T(3, 1), T(4, -1), T(4, 0)], 'C', 5),
        names: true,
        piano: { low: 60, high: 72, marks: [65, 66, 67] },
      },
      {
        title: 'Une touche noire, deux noms',
        text: [
          'Fa dièse et sol bémol, c’est la même touche noire. Le nom dépend du contexte musical, pas du clavier. Pour la lecture, seul le geste compte : dièse à droite, bémol à gauche.',
          'Attention aux voisines sans touche noire : mi dièse est le fa, si dièse est le do, fa bémol est le mi, do bémol est le si. Elles n’apparaissent pas dans ce palier.',
        ],
        score: pitches('treble', [T(3, 1), T(4, -1)], 'C', 5),
        names: true,
        piano: { low: 60, high: 72, marks: [66] },
      },
    ],
  },
  {
    levelId: 'p7',
    steps: [
      {
        title: 'L’armure',
        text: [
          'Les dièses ou bémols placés juste après la clé forment l’armure. Ils s’appliquent à toutes les notes de ce nom, dans toutes les octaves, pour tout le morceau, sans être réécrits.',
          'Ici, deux dièses : tous les fa et tous les do se jouent dièse, même si la note est écrite sans altération.',
        ],
        score: pitches('grand', [T(3), T(7), B(-4), B(-7)], 'D'),
        names: true,
        piano: { low: 48, high: 84, marks: [49, 54, 66, 73] },
      },
      {
        title: 'L’ordre des dièses',
        text: [
          'Les dièses arrivent toujours dans le même ordre : fa, do, sol, ré, la, mi, si. Un dièse, tonalité de sol majeur. Deux, ré majeur. Trois, la majeur.',
          'Astuce : le dernier dièse plus un demi-ton donne le nom de la tonalité.',
        ],
        score: pitches('grand', [], 'A'),
      },
      {
        title: 'L’ordre des bémols',
        text: [
          'Les bémols : si, mi, la, ré, sol, do, fa. Un bémol, fa majeur. Deux, si bémol majeur. Trois, mi bémol majeur.',
          'Astuce : l’avant-dernier bémol donne le nom de la tonalité. Avec un seul bémol il n’y a pas d’avant-dernier : c’est fa majeur, à retenir à part.',
        ],
        score: pitches('grand', [], 'Eb'),
      },
      {
        title: 'Le bécarre dans l’armure',
        text: [
          'Quand le compositeur veut la touche blanche malgré l’armure, il écrit un bécarre devant la note. En sol majeur, un fa avec bécarre se joue fa naturel.',
          'Dans ce palier, les tonalités se travaillent une par une, dans l’ordre sol, ré, la, fa, si bémol, mi bémol, et chacune se valide séparément. Regarde l’armure une fois au début de la série, puis lis normalement.',
        ],
        score: pitches('treble', [T(3), T(3, 0)], 'G', 5),
        names: true,
        piano: { low: 60, high: 72, marks: [65, 66] },
      },
    ],
  },
  {
    levelId: 'r1',
    steps: [
      {
        title: 'La pulsation',
        text: [
          'Le métronome bat la pulsation. En 4/4, chaque mesure compte quatre temps et le premier est accentué. Les barres verticales séparent les mesures.',
          'Compte à voix basse : un, deux, trois, quatre. Tout le rythme se lit par rapport à ce compte.',
        ],
        score: rhythm([{ elements: [q(0), q(1), q(2), q(3)] }]),
        labels: { 0: '1', 1: '2', 2: '3', 3: '4' },
      },
      {
        title: 'Les valeurs',
        text: [
          'La noire dure un temps, tête pleine avec une hampe. La blanche dure deux temps, tête vide. La blanche pointée dure trois temps, le point ajoute la moitié de la valeur. La ronde dure quatre temps, tête vide sans hampe.',
        ],
        score: rhythm([{ elements: [q(0), q(1), q(2), q(3)] }, { elements: [h(0), h(2)] }, { elements: [h(0, 1), q(3)] }, { elements: [w(0)] }]),
        labels: { 0: '1', 1: '2', 2: '3', 3: '4', 4: '1', 5: '3', 6: '1', 7: '4', 8: '1' },
      },
      {
        title: 'Comment jouer',
        text: [
          'Tape n’importe quelle touche exactement au moment de l’attaque de chaque note. La durée pendant laquelle tu maintiens la touche n’est pas notée, seul le moment compte.',
          'Une mesure de décompte précède l’exercice. À moins de 60\u00A0ms de l’attaque, c’est parfait. À moins de 120\u00A0ms, c’est bon. Entre 120 et 200\u00A0ms, la note compte pour moitié. Au-delà de 200\u00A0ms, elle est comptée manquée.',
        ],
      },
    ],
  },
  {
    levelId: 'r2',
    steps: [
      {
        title: 'La croche',
        text: [
          'La croche dure un demi-temps. Deux croches remplissent un temps et sont reliées par une barre horizontale, la ligature. Seule, la croche porte un crochet.',
          'Compte «\u00A0un et deux et trois et quatre et\u00A0» : la première croche tombe sur le chiffre, la seconde sur le «\u00A0et\u00A0».',
        ],
        score: rhythm([{ elements: [e(0, 1), e(0.5, 1), e(1, 2), e(1.5, 2), q(2), q(3)] }]),
        labels: { 0: '1', 1: 'et', 2: '2', 3: 'et', 4: '3', 5: '4' },
      },
      {
        title: 'La noire pointée',
        text: [
          'Le point ajoute la moitié de la valeur : la noire pointée dure un temps et demi. Elle est presque toujours suivie d’une croche qui complète le deuxième temps.',
          'Attaque sur le temps, puis la croche sur le «\u00A0et\u00A0» du temps suivant.',
        ],
        score: rhythm([{ elements: [q(0, 1), e(1.5), q(2, 1), e(3.5)] }]),
        labels: { 0: '1', 1: 'et', 2: '3', 3: 'et' },
      },
    ],
  },
  {
    levelId: 'r3',
    steps: [
      {
        title: 'Les silences',
        text: [
          'Un silence se compte comme une note, mais sans attaque. Le soupir vaut un temps de silence, la demi-pause vaut deux temps et se pose sur la troisième ligne.',
          'Pendant un silence, ne tape rien et continue de compter.',
        ],
        score: rhythm([{ elements: [q(0), rq(1), q(2), rq(3)] }, { elements: [rh(0), h(2)] }]),
        labels: { 0: '1', 1: '2', 2: '3', 3: '4', 4: '1', 5: '3' },
      },
      {
        title: 'La pause',
        text: [
          'La pause vaut quatre temps de silence, une mesure entière en 4/4. Elle s’accroche sous la quatrième ligne, alors que la demi-pause se pose sur la troisième.',
          'Dans l’exercice, la dernière mesure peut être entièrement silencieuse : compte ses quatre temps sans rien taper, l’exercice se termine avec elle.',
        ],
        score: rhythm([{ elements: [q(0), q(1), h(2)] }, { elements: [rw(0)] }]),
        labels: { 0: '1', 1: '2', 2: '3', 3: '1 2 3 4' },
      },
      {
        title: 'Garder la pulsation',
        text: [
          'Le piège du silence, c’est de repartir trop tôt. Le métronome continue, appuie-toi dessus et compte les temps du silence à voix basse.',
          'Une attaque pendant un silence est comptée comme une note en trop.',
        ],
      },
    ],
  },
  {
    levelId: 'f0',
    steps: [
      {
        title: 'Cinq doigts, cinq notes',
        text: [
          'Pose la main droite avec le pouce sur le do central : chaque doigt a sa touche blanche, du do4 au sol4. Les phrases de ce palier ne sortent pas de cette position.',
          'Une note par doigt, sans déplacer la main : tes yeux restent sur la portée.',
        ],
        score: pitches('treble', [T(0), T(1), T(2), T(3), T(4)]),
        names: true,
        piano: { low: 60, high: 72, marks: [60, 62, 64, 65, 67] },
      },
      {
        title: 'Hauteur et rythme ensemble',
        text: [
          'Chaque note répond à deux questions : quelle touche, et à quel moment. La hauteur se lit sur la portée, le moment sur la valeur de la note, noire, blanche, blanche pointée ou ronde, comme dans les exercices de rythme.',
          'Une mesure de décompte, puis joue chaque note au moment de son attaque. Une fausse note est signalée d’une croix, une note en retard ou en avance par son écart en millisecondes.',
        ],
        score: melody([{ elements: [n('q', 0, 0), n('q', 1, 2), n('h', 2, 4)] }, { elements: [n('h', 0, 2, 1), n('q', 3, 0)] }]),
        names: true,
      },
    ],
  },
  {
    levelId: 'f1',
    steps: [
      {
        title: 'Lire deux choses à la fois',
        text: [
          'La même lecture que dans Cinq notes, sur une étendue plus large : la hauteur se lit sur la portée, le moment sur la valeur de la note. Les croches par deux et la noire pointée, vues dans les exercices de rythme, s’y ajoutent.',
          'Lis en avance : pendant que tu joues une note, tes yeux sont déjà sur la suivante.',
        ],
        score: melody([
          { elements: [n('q', 0, 4), ne(1, 5, 1), ne(1.5, 6, 1), n('h', 2, 7)] },
          { elements: [n('q', 0, 8, 1), ne(1.5, 7), n('h', 2, 4)] },
        ]),
      },
      {
        title: 'Avant de commencer',
        text: [
          'Pendant la mesure de décompte, repère la première note et pose ta main. Les phrases de ce palier vont du do4 au sol5, plus large qu’une main : garde le pouce sur le do central comme point de départ et déplace la main quand la phrase monte.',
          'Une fausse note est signalée d’une croix, une note en retard ou en avance par son écart en millisecondes.',
        ],
        piano: { low: 60, high: 84, marks: [60, 62, 64, 65, 67] },
      },
    ],
  },
  {
    levelId: 'f2',
    steps: [
      {
        title: 'La main gauche',
        text: [
          'Même exercice en clé de fa. Les phrases vont du la2 au mi4, plus large qu’une main : pars de l’auriculaire sur le do3 et déplace la main quand la phrase sort de la position.',
          'Les repères de la clé de fa sont le fa3 entre les points de la clé et le do3 dans le deuxième interligne.',
        ],
        score: pitches('bass', [B(-7), B(-6), B(-5), B(-4), B(-3)], 'C', 3),
        names: true,
        piano: { low: 36, high: 72, marks: [48, 50, 52, 53, 55] },
      },
      {
        title: 'Lire en avance',
        text: [
          'Le rythme se lit exactement comme pour la main droite. Anticipe la note suivante, garde le métronome dans l’oreille et laisse passer une fausse note sans t’arrêter : la phrase continue.',
        ],
      },
    ],
  },
  {
    levelId: 'f3',
    steps: [
      {
        title: 'Une mesure pour chaque main',
        text: [
          'Sur la grande portée, la clé de sol est pour la main droite et la clé de fa pour la main gauche. Dans ce palier, chaque mesure est pour une seule main.',
          'Pendant ce temps, l’autre portée affiche une pause : cette main se repose et compte ses quatre temps.',
        ],
        score: grand([
          { elements: [pause('bass'), n('q', 0, 0), n('q', 1, 1), n('h', 2, 2)] },
          { elements: [pause('treble'), n('h', 0, -3, 0, 'bass'), n('h', 2, -7, 0, 'bass')] },
        ]),
        names: true,
        piano: { low: 48, high: 67, marks: [48, 60] },
      },
      {
        title: 'Les deux positions',
        text: [
          'Place les deux mains avant de commencer : le pouce droit sur le do central, l’auriculaire gauche sur le do3. Chaque main garde ses cinq touches, seuls les yeux passent d’une portée à l’autre.',
          'Pendant la mesure de décompte, repère la portée qui commence. Sur l’écran, joue avec un pouce de chaque côté.',
        ],
        piano: { low: 48, high: 67, marks: [48, 50, 52, 53, 55, 60, 62, 64, 65, 67] },
      },
    ],
  },
  {
    levelId: 'f4',
    steps: [
      {
        title: 'Lire à la verticale',
        text: [
          'Deux notes alignées l’une au-dessus de l’autre se jouent en même temps. Les deux notes en bleu tombent ensemble sur le premier temps.',
          'La main gauche tient une ronde pendant toute la mesure, la main droite joue la mélodie par-dessus. Attaque les deux ensemble, puis laisse la gauche tenir.',
        ],
        score: grand([
          { elements: [n('w', 0, -7, 0, 'bass'), n('q', 0, 2), n('q', 1, 1), n('h', 2, 0)] },
          { elements: [n('w', 0, -3, 0, 'bass'), n('q', 0, 1), n('q', 1, 2), n('h', 2, 1)] },
        ]),
        accent: [0, 1],
        piano: { low: 48, high: 67, marks: [48, 55, 60, 62, 64] },
      },
      {
        title: 'Chaque main compte',
        text: [
          'Chaque note est jugée séparément. Si une main rate son attaque, l’autre continue : ne t’arrête pas.',
          'Avec un piano numérique branché en MIDI, les deux mains jouent sur tes vraies touches. Sur l’écran, pose un pouce de chaque côté.',
        ],
        piano: { low: 48, high: 67, marks: [48, 60] },
      },
    ],
  },
  {
    levelId: 'e1',
    steps: [
      {
        title: 'Écouter avant de lire',
        text: [
          'Ici, la note ne s’affiche pas : tu l’entends. Le do central sonne d’abord comme repère, puis la note à trouver. Joue-la sur le clavier.',
          'Une fois ta réponse donnée, la note apparaît sur la portée : l’oreille, les yeux et la main apprennent ensemble.',
        ],
        score: pitches('treble', [T(0), T(2), T(4), T(7)]),
        names: true,
        piano: { low: 60, high: 72, marks: [60, 64, 67, 72] },
      },
      {
        title: 'Comparer au repère',
        text: [
          'Compare chaque note au do de départ : plus elle est aiguë, plus la touche est à droite. Le do aigu sonne comme le do de départ, une octave plus haut.',
          'Tu peux réécouter autant de fois que tu veux. Le temps compté part de la note à trouver, pas du repère.',
        ],
        piano: { low: 60, high: 72, marks: [60, 72] },
      },
    ],
  },
  {
    levelId: 'e2',
    steps: [
      {
        title: 'La gamme de do',
        text: [
          'Les huit notes de la gamme, du do central au do aigu. Chante-les dans ta tête en montant : do, ré, mi, fa, sol, la, si, do.',
          'Pour trouver une note, remonte la gamme depuis le repère jusqu’à ce qu’elle sonne pareil.',
        ],
        score: pitches('treble', [T(0), T(1), T(2), T(3), T(4), T(5), T(6), T(7)], 'C', 3),
        names: true,
        piano: { low: 60, high: 72, marks: [60, 62, 64, 65, 67, 69, 71, 72] },
      },
    ],
  },
]

export function lessonFor(levelId: string): ILesson | undefined {
  return LESSONS.find((l) => l.levelId === levelId)
}
