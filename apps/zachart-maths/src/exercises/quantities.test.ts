import { describe, expect, it } from 'vitest'
import { findQuantities } from './quantities'

/** Ce que `findQuantities` trouve, vu comme le texte coupé : plus lisible que des indices. */
const found = (text: string) => findQuantities(text).map(q => ({ text: text.slice(q.start, q.end), unit: q.unit, kind: q.kind }))

describe('findQuantities', () => {
  it('trouve une valeur et son unité, accolées ou non', () => {
    expect(found('16 km')).toEqual([{ text: '16 km', unit: 'km', kind: 'valeur' }])
    expect(found('16km')).toEqual([{ text: '16km', unit: 'km', kind: 'valeur' }])
  })

  it("trouve la vitesse et la distance de l'exemple, chacune avec son unité", () => {
    expect(found('Je vais à 3 km/h, en combien de temps je fais 16 km ?')).toEqual([
      { text: '3 km/h', unit: 'km/h', kind: 'valeur' },
      { text: '16 km', unit: 'km', kind: 'valeur' },
    ])
  })

  it('reconnaît une inconnue suivie d\'une unité', () => {
    expect(found('x km/h')).toEqual([{ text: 'x km/h', unit: 'km/h', kind: 'valeur' }])
    expect(found('t min')).toEqual([{ text: 't min', unit: 'min', kind: 'valeur' }])
  })

  it('trouve une unité composée seule, et une unité longue seule', () => {
    expect(found('en km/h')).toEqual([{ text: 'km/h', unit: 'km/h', kind: 'unite' }])
    expect(found('exprime en min')).toEqual([{ text: 'min', unit: 'min', kind: 'unite' }])
    expect(found('une aire en m²')).toEqual([{ text: 'm²', unit: 'm²', kind: 'unite' }])
  })

  it('ne colore pas une unité d\'une lettre sans nombre devant', () => {
    expect(found('un m')).toEqual([])
    expect(found('exprimer en h')).toEqual([])
    expect(found('la lettre s')).toEqual([])
  })

  it('colore une unité d\'une lettre derrière un nombre', () => {
    expect(found('il court 3 s')).toEqual([{ text: '3 s', unit: 's', kind: 'valeur' }])
    expect(found('5 m')).toEqual([{ text: '5 m', unit: 'm', kind: 'valeur' }])
  })

  it('ne combine pas une inconnue avec une unité d\'un seul caractère', () => {
    expect(found('t s')).toEqual([])
    expect(found('x m')).toEqual([])
  })

  it('ne confond pas un mot avec une unité', () => {
    expect(found('16 kilos')).toEqual([])
    expect(found('3 solutions')).toEqual([])
    expect(found('12 mètres')).toEqual([])
  })

  it('ne prend pas la lettre d\'un mot pour une inconnue', () => {
    // Le « x » de « max » n'en est pas une ; « km » reste une unité longue, colorée seule.
    expect(found('max km')).toEqual([{ text: 'km', unit: 'km', kind: 'unite' }])
  })

  it('lit les décimales à virgule ou à point, et les milliers séparés par une espace', () => {
    expect(found('3,5 km')).toEqual([{ text: '3,5 km', unit: 'km', kind: 'valeur' }])
    expect(found('3.5 km')).toEqual([{ text: '3.5 km', unit: 'km', kind: 'valeur' }])
    expect(found('1 200 m')).toEqual([{ text: '1 200 m', unit: 'm', kind: 'valeur' }])
    expect(found('1 200 m')).toEqual([{ text: '1 200 m', unit: 'm', kind: 'valeur' }])
  })

  it('reconnaît %, €, ° et les puissances', () => {
    expect(found('25 %')).toEqual([{ text: '25 %', unit: '%', kind: 'valeur' }])
    expect(found('25%')).toEqual([{ text: '25%', unit: '%', kind: 'valeur' }])
    expect(found('12 €')).toEqual([{ text: '12 €', unit: '€', kind: 'valeur' }])
    expect(found('90°')).toEqual([{ text: '90°', unit: '°', kind: 'valeur' }])
    expect(found('5 m²')).toEqual([{ text: '5 m²', unit: 'm²', kind: 'valeur' }])
    expect(found('4 m^2')).toEqual([{ text: '4 m^2', unit: 'm²', kind: 'valeur' }])
    expect(found('2 kg/m³')).toEqual([{ text: '2 kg/m³', unit: 'kg/m³', kind: 'valeur' }])
    expect(found('12 €/kg')).toEqual([{ text: '12 €/kg', unit: '€/kg', kind: 'valeur' }])
  })

  it('met les litres sous une forme unique', () => {
    expect(found('2 l')).toEqual([{ text: '2 l', unit: 'L', kind: 'valeur' }])
    expect(found('25 cl')).toEqual([{ text: '25 cl', unit: 'cL', kind: 'valeur' }])
    expect(found('3 mL')).toEqual([{ text: '3 mL', unit: 'mL', kind: 'valeur' }])
  })

  it('ne trouve pas deux fois la même unité (valeur + unité seule)', () => {
    expect(findQuantities('16 km')).toHaveLength(1)
    expect(findQuantities('3 km/h')).toHaveLength(1)
  })

  it('donne des indices exacts dans le texte', () => {
    const text = 'Il fait 16 km puis 4 km.'
    const [first, second] = findQuantities(text)
    expect(first.start).toBe(text.indexOf('16 km'))
    expect(first.end).toBe(text.indexOf('16 km') + '16 km'.length)
    expect(second.start).toBe(text.indexOf('4 km'))
  })

  it('ne trouve rien dans un texte sans grandeur', () => {
    expect(found('Résous x + 3 = 5')).toEqual([])
    expect(found('')).toEqual([])
  })

  it('ne colore jamais la lettre t seule, avec ou sans puissance', () => {
    expect(found('t² - 4')).toEqual([])
    expect(found('t^2')).toEqual([])
    expect(found('t + 5')).toEqual([])
  })

  it('reconnaît 2 t avec espace (tonnes), mais pas 2t (produit algébrique)', () => {
    expect(found('2 t')).toEqual([{ text: '2 t', unit: 't', kind: 'valeur' }])
    expect(found('2t + 3 = 7')).toEqual([])
  })

  it('ne prend pas 4,9t² ni 2t² pour une unité (formules de chute libre, polynômes)', () => {
    expect(found('d = 4,9t²')).toEqual([])
    expect(found('f(t) = 2t² + 3t')).toEqual([])
    expect(found('2t³')).toEqual([])
    expect(found('1 000t')).toEqual([])
  })

  it('reconnaît 2 t² avec espace, et garde 5m, 5 m² et x km/h', () => {
    expect(found('2 t²')).toEqual([{ text: '2 t²', unit: 't²', kind: 'valeur' }])
    expect(found('5m')).toEqual([{ text: '5m', unit: 'm', kind: 'valeur' }])
    expect(found('5 m²')).toEqual([{ text: '5 m²', unit: 'm²', kind: 'valeur' }])
    expect(found('x km/h')).toEqual([{ text: 'x km/h', unit: 'km/h', kind: 'valeur' }])
  })
})
