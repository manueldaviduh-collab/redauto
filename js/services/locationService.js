import { getItem, setItem } from './storage.js';

// Única fuente de la ubicación que el comprador eligió (mismo dato que ya
// existía como "city_pref", ver docs/BASE_DE_DATOS.md) — antes vivía
// repartida dentro de home.js con un valor por defecto ('Caracas') que
// hacía imposible distinguir "no elegí nada" de "elegí Caracas". Ahora
// null = sin ubicación elegida = sin filtro (comportamiento de siempre).
// `state` queda reservado, sin usarse todavía, para cuando haga falta
// filtrar por estado o (más adelante) por distancia — mismo mecanismo,
// sin rediseñar nada cuando llegue ese momento.
export const locationService = {
  getCity() {
    return getItem('city_pref', null);
  },
  setCity(city) {
    setItem('city_pref', city);
  },
  getState() {
    return getItem('state_pref', null);
  },
  setState(state) {
    setItem('state_pref', state);
  },
};
