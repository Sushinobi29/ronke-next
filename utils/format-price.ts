export const formatPrice = (price: string | null) => {
  if (!price) return "N/A";
  const value = parseFloat(price) / 1e18;
  return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toFixed(1);
};
