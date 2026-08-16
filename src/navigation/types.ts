export type GuestStackParamList = {
  Home: undefined;
  Menu: undefined;
  ItemDetail: { itemId: string };
  Cart: undefined;
  Checkout: undefined;
  OrderStatus: { orderId: string };
  OrderHistory: undefined;
  Reserve: undefined;
  Profile: undefined;
};

export type StaffTabParamList = {
  Kitchen: undefined;
  Host: undefined;
};

export type OwnerTabParamList = {
  Kitchen: undefined;
  Host: undefined;
  MenuManager: undefined;
  Analytics: undefined;
  Promos: undefined;
  Settings: undefined;
};
