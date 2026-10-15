// The people of the road and what one says to them: the instructor at the driving school (lessons, the theory,
// the practical exam), the mechanic at the service station (a car, the pump, the oil, the tyres, a repair), the
// officer at the police (fines, the licence), the one in the next bunk. Everything is told in their words; the
// licence shows its coupon with the holes punched in it.

import type { AskChoice, AskContent } from '../ui/ask';
import type { Command, CommandResult, DriveView } from '../types';
import { couponPlaces } from './rules';
import { t } from '../i18n';

export interface DeskHost {
  view(): DriveView | null;
  run(cmd: Command): CommandResult;
  open(c: AskContent): void;
  close(): void;
  /** The people: the instructor, the mechanic, an officer on duty (names). */
  who(role: 'instructor' | 'mechanic' | 'officer'): string;
  coins(): number;
  /** Sets off on the practical exam (out to the street, into the school's car). */
  startExam(): void;
  /** Out to the car (it stands in the town). */
  toCar(): void;
  say(text: string, good?: boolean): void;
  sfx(name: string): void;
  /** The day number of the world now. */
  today(): number;
}

const SERVICE_WORDS: Record<string, string> = { oil: 'drive.desk.oil', tyres: 'drive.desk.tyres', repair: 'drive.desk.repair' };

/** The coupon of the licence: a whole place «▣», a punched hole «○». */
export function couponLine(holes: number, coupon: number): string {
  return couponPlaces(holes, coupon)
    .map((p) => (p ? '○' : '▣'))
    .join(' ');
}

export class DriveDesk {
  constructor(private readonly host: DeskHost) {}

  // ---- the driving school ----------------------------------------------------------------------------------

  school(): void {
    const v = this.host.view();
    if (!v) return;
    const who = this.host.who('instructor');
    const choices: AskChoice[] = [];
    let text: string;
    if (!v.school_open) {
      text = t('drive.desk.schoolShut');
    } else if (v.licence !== null) {
      text = t('drive.desk.schoolDriver');
    } else if (v.back_in !== null) {
      text = t('drive.desk.licenceTaken', { when: v.back_in === 1 ? t('drive.desk.inADay') : t('drive.desk.inDays', { n: v.back_in }) });
    } else if (v.fines_due > 0) {
      text = t('drive.desk.schoolFineFirst');
    } else if (v.next_lesson && v.lessons_done < v.lessons_total) {
      if (v.lesson_today) {
        text = t('drive.desk.schoolEnough');
      } else {
        text = v.lessons_done === 0
          ? t('drive.desk.firstLesson', { price: v.lesson_price })
          : t('drive.desk.todayLesson', { title: v.next_lesson.title });
        choices.push({ label: t('drive.desk.lessonChoice', { title: v.next_lesson.title, price: v.lesson_price }), primary: true, disabled: this.host.coins() < v.lesson_price, run: () => this.lesson() });
      }
    } else if (!v.theory) {
      if (v.theory_today) text = t('drive.desk.theoryToday');
      else {
        text = t('drive.desk.theoryIntro', { pass: v.theory_pass, price: v.theory_price });
        choices.push({ label: t('drive.desk.theoryChoice', { price: v.theory_price }), primary: true, disabled: this.host.coins() < v.theory_price, run: () => this.theory() });
      }
    } else if (v.exam !== null) {
      text = t('drive.desk.carWaits');
      choices.push({ label: t('drive.desk.toCar'), primary: true, run: () => this.host.startExam() });
    } else if (v.exam_today) {
      text = t('drive.desk.examTomorrow');
    } else {
      text = t('drive.desk.routeIntro', { price: v.exam_price });
      choices.push({ label: t('drive.desk.routeChoice', { price: v.exam_price }), primary: true, disabled: this.host.coins() < v.exam_price, run: () => this.exam() });
    }
    choices.push({ label: t('drive.desk.bye'), run: () => this.host.close() });
    this.host.open({ who, title: t('drive.desk.schoolTitle'), text, choices });
  }

  private lesson(): void {
    const v = this.host.view();
    const lesson = v?.next_lesson;
    if (!lesson) return;
    const r = this.host.run({ type: 'lesson' });
    if (!r.ok) return;
    this.host.sfx('page');
    this.lessonLine(lesson.title, lesson.lines, 0);
  }

  private lessonLine(title: string, lines: string[], i: number): void {
    const last = i >= lines.length - 1;
    this.host.open({
      who: this.host.who('instructor'),
      title,
      text: lines[i] ?? '',
      choices: [last ? { label: t('drive.desk.thanksTomorrow'), primary: true, run: () => this.host.close() } : { label: t('drive.desk.next'), primary: true, run: () => this.lessonLine(title, lines, i + 1) }],
    });
  }

  private theory(): void {
    const v = this.host.view();
    if (!v || v.questions.length === 0) return;
    this.question(v, 0, []);
  }

  private question(v: DriveView, i: number, answers: number[]): void {
    const q = v.questions[i];
    if (!q) {
      this.finishTheory(answers);
      return;
    }
    this.host.open({
      who: this.host.who('instructor'),
      title: t('drive.desk.question', { i: i + 1, n: v.questions.length }),
      text: q.q,
      choices: q.answers.map((a, k) => ({ label: a, run: () => this.question(v, i + 1, [...answers, k]) })),
    });
  }

  private finishTheory(answers: number[]): void {
    const r = this.host.run({ type: 'theory', answers });
    if (!r.ok) return;
    const e = r.events.find((x) => x.kind.type === 'TheoryTaken')?.kind as { passed?: boolean; right?: number } | undefined;
    const passed = !!e?.passed;
    this.host.sfx(passed ? 'chime' : 'tap');
    this.host.open({
      who: this.host.who('instructor'),
      title: passed ? t('drive.desk.theoryPassed') : t('drive.desk.notThisTime'),
      text: passed ? t('drive.desk.theoryPassedText') : t('drive.desk.theoryFailedText'),
      choices: [{ label: t('drive.desk.ok'), primary: true, run: () => this.host.close() }],
    });
  }

  private exam(): void {
    const r = this.host.run({ type: 'start_exam' });
    if (!r.ok) return;
    this.host.sfx('switch');
    this.host.open({
      who: this.host.who('instructor'),
      title: t('drive.desk.route'),
      text: t('drive.desk.routeText'),
      choices: [{ label: t('drive.desk.toCar'), primary: true, run: () => this.host.startExam() }],
    });
  }

  /** The instructor's verdict at the end of the route. */
  examResult(passed: boolean, faults: string[]): void {
    const v = this.host.view();
    const names = faults.map((f) => v?.fines.find((x) => x.kind === f)?.name ?? f);
    this.host.open({
      who: this.host.who('instructor'),
      title: passed ? t('drive.desk.examPassed') : t('drive.desk.examFailed'),
      text: passed
        ? names.length > 0
          ? t('drive.desk.examOneFault', { fault: names[0] })
          : t('drive.desk.examClean')
        : t('drive.desk.examNo', { why: names.length > 0 ? t('drive.desk.examNoted', { faults: names.join(', ') }) : t('drive.desk.notFinished') }),
      lines: passed ? [{ text: t('drive.desk.licenceCoupon', { coupon: couponLine(0, v?.coupon ?? 5) }), ok: true }] : undefined,
      choices: [{ label: passed ? t('drive.desk.thanks!') : t('drive.desk.ok'), primary: true, run: () => this.host.close() }],
    });
  }

  // ---- the service station --------------------------------------------------------------------------------

  sto(): void {
    const v = this.host.view();
    if (!v) return;
    const who = this.host.who('mechanic');
    const coins = this.host.coins();
    if (!v.sto_open) {
      this.host.open({ who: t('drive.desk.stoName'), text: t('drive.desk.stoShut'), choices: [{ label: t('drive.desk.ok'), run: () => this.host.close() }] });
      return;
    }
    const car = v.car;
    if (!car) {
      this.host.open({
        who,
        title: t('drive.desk.carsForSale'),
        text: t('drive.desk.mechanicSale', { end: v.licence === null ? t('drive.desk.saleNoLicence') : t('drive.desk.salePick') }),
        lines: v.cars.map((c) => ({ text: t('drive.desk.carLine', { name: c.name, text: c.text, price: c.price }) })),
        choices: [
          ...v.cars.map((c) => ({ label: t('drive.desk.buyCar', { name: c.name, price: c.price }), disabled: coins < c.price, run: () => this.buy(c.id) })),
          { label: t('drive.desk.think'), run: () => this.host.close() },
        ],
      });
      return;
    }
    const choices: AskChoice[] = [];
    if (car.at_sto && car.fuel < 100) {
      const cost = Math.ceil((100 - car.fuel) / 10) * v.fuel_price;
      choices.push({ label: t('drive.desk.refuel', { cost }), primary: true, disabled: coins < cost, run: () => this.serve({ type: 'refuel' }, t('drive.desk.refuelDone')) });
    }
    for (const what of ['repair', 'oil', 'tyres']) {
      const price = what === 'oil' ? v.oil_price : what === 'tyres' ? v.tyres_price : v.repair_price;
      const wanted = car.needs.includes(what);
      if (!wanted && what === 'repair') continue;
      if (!car.at_sto && !(what === 'repair' && car.broken)) continue;
      choices.push({ label: `${t(SERVICE_WORDS[what])} · ${price}`, primary: wanted && !choices.some((c) => c.primary), disabled: coins < price, run: () => this.serve({ type: 'service', what }, what === 'repair' ? (car.at_sto ? t('drive.desk.repairHere') : t('drive.desk.repairTowed')) : what === 'oil' ? t('drive.desk.oilDone') : t('drive.desk.tyresDone')) });
    }
    const text = car.at_sto
      ? t('drive.desk.carHere', { name: car.name, words: car.words.join(' ') })
      : t('drive.desk.carAway', { name: car.name, words: car.words.join(' ').toLowerCase() });
    choices.push({ label: t('drive.desk.thanks'), run: () => this.host.close() });
    this.host.open({ who, title: t('drive.desk.stoName'), text, choices });
  }

  private buy(id: string): void {
    const r = this.host.run({ type: 'buy_car', car: id });
    if (!r.ok) return;
    const v = this.host.view();
    this.host.sfx('buy');
    this.host.open({
      who: this.host.who('mechanic'),
      title: t('drive.desk.keysYours'),
      text: t('drive.desk.keysText', { car: v?.car?.name ?? t('drive.desk.car'), end: v?.licence === null ? t('drive.desk.keysSchool') : t('drive.desk.keysGoodRoad') }),
      choices: [{ label: t('drive.desk.toCar'), primary: true, run: () => { this.host.close(); this.host.toCar(); } }, { label: t('drive.desk.later'), run: () => this.host.close() }],
    });
  }

  private serve(cmd: Command, words: string): void {
    const r = this.host.run(cmd);
    if (!r.ok) return;
    this.host.sfx('buy');
    this.host.say(words, true);
    this.sto();
  }

  // ---- the police ------------------------------------------------------------------------------------------

  police(): void {
    const v = this.host.view();
    if (!v) return;
    const who = this.host.who('officer');
    const coins = this.host.coins();
    const choices: AskChoice[] = [];
    let text: string;
    if (v.fines_due > 0) {
      text = t('drive.desk.fineDue', { fine: v.fines_due });
      choices.push({ label: t('drive.desk.payFine', { fine: v.fines_due }), primary: true, disabled: coins < v.fines_due, run: () => this.payFine() });
    } else if (v.licence !== null) {
      text = v.holes === 0 ? t('drive.desk.noFines') : t('drive.desk.couponWarn', { coupon: couponLine(v.holes, v.coupon) });
    } else if (v.back_in !== null) {
      text = t('drive.desk.licenceHeld', { when: v.back_in === 1 ? t('drive.desk.inADay') : t('drive.desk.inDays', { n: v.back_in }) });
    } else {
      text = t('drive.desk.policeHello');
    }
    choices.push({ label: t('drive.desk.goodbye'), run: () => this.host.close() });
    this.host.open({ who, title: t('drive.desk.officer'), text, choices });
  }

  private payFine(): void {
    const r = this.host.run({ type: 'pay_fine' });
    if (!r.ok) return;
    this.host.sfx('buy');
    this.host.say(t('drive.desk.finePaid'), true);
    this.host.close();
  }

  /** On the road: the officer stops the car for what was seen. */
  stopped(kind: string, fine: number, paid: boolean, arrested: boolean, then: () => void): void {
    const v = this.host.view();
    const name = v?.fines.find((f) => f.kind === kind)?.name ?? kind;
    const who = this.host.who('officer');
    const coupon = v && v.licence !== null ? [{ text: t('drive.desk.coupon', { coupon: couponLine(v.holes, v.coupon) }), ok: v.holes < 3 }] : [];
    if (arrested) {
      this.host.open({
        who,
        title: t('drive.desk.police'),
        text: kind === 'no_licence' || v?.licence === null
          ? t('drive.desk.arrestNoLicence', { tone: v?.tone ?? t('drive.desk.papers') })
          : t('drive.desk.arrestFull', { name }),
        lines: [{ text: paid ? t('drive.desk.finePaidHere', { fine }) : t('drive.desk.fineAtStation', { fine }), ok: paid }],
        choices: [{ label: t('drive.desk.goWithThem'), primary: true, run: () => { this.host.close(); then(); } }],
      });
      return;
    }
    this.host.open({
      who,
      title: t('drive.desk.police'),
      text: t('drive.desk.stopped', { tone: v?.tone ?? t('drive.desk.papersPlease'), name }),
      lines: [{ text: paid ? t('drive.desk.finePaidHere', { fine }) : t('drive.desk.fineToPay', { fine }), ok: paid }, ...coupon],
      choices: [{ label: t('drive.desk.understood'), primary: true, run: () => { this.host.close(); then(); } }],
    });
  }

  // ---- the licence, and the cell ---------------------------------------------------------------------------

  licence(): void {
    const v = this.host.view();
    if (!v) return;
    if (v.licence === null) {
      this.host.open({ who: t('drive.desk.licence'), text: v.back_in !== null ? t('drive.desk.licenceInSafe') : t('drive.desk.licenceNone'), choices: [{ label: t('drive.desk.close'), run: () => this.host.close() }] });
      return;
    }
    const why = [...new Set(v.hole_names)].map((n) => ({ text: t(v.hole_names.filter((x) => x === n).length > 1 ? 'drive.desk.holes' : 'drive.desk.hole', { name: n }), ok: false }));
    const lines = [{ text: t('drive.desk.coupon', { coupon: couponLine(v.holes, v.coupon) }), ok: v.holes === 0 }, ...why];
    if (v.fines_due > 0) lines.push({ text: t('drive.desk.unpaid', { fine: v.fines_due }), ok: false });
    this.host.open({
      who: t('drive.desk.licence'),
      text: v.holes === 0 ? t('drive.desk.licenceClean') : t('drive.desk.licencePunched'),
      lines,
      choices: [{ label: t('drive.desk.close'), run: () => this.host.close() }],
    });
  }

  cell(): void {
    const v = this.host.view();
    const lines = v?.cellmate ?? [];
    this.cellLine(lines, 0);
  }

  private cellLine(lines: string[], i: number): void {
    const last = i >= lines.length - 1;
    this.host.open({
      who: t('drive.desk.cell'),
      text: lines[i] ?? t('drive.desk.cellQuiet'),
      choices: [last ? { label: t('drive.desk.lieDown'), primary: true, run: () => this.host.close() } : { label: t('drive.desk.listenMore'), primary: true, run: () => this.cellLine(lines, i + 1) }],
    });
  }
}
