alter table restaurants add column card_terminal_mexican_cards_only boolean not null default false;
grant update (accepts_cash, accepts_transfer, accepts_card_terminal, card_terminal_mexican_cards_only) on restaurants to authenticated;
