const star = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.00 1.00L14.82 9.12L23.41 9.29L16.57 14.48L19.05 22.71L12.00 17.80L4.95 22.71L7.43 14.48L0.59 9.29L9.18 9.12z"/></svg>';

export function characterStars(count, unknown = false) {
  return `<span class="stars${unknown ? ' unknown' : ''}" role="img" aria-label="${unknown ? '星级未定' : count+'星'}">${star.repeat(count)}</span>`;
}
