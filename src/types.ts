/* Copyright (c) 2021-25 MIT 6.102/6.031 course staff, all rights reserved.
 * Redistribution of original or derived work requires permission of course staff.
 */

type CardState = 'down' | 'up' | 'none';

export interface Card {
    label: string;
    state: CardState;
    controlledBy: string | null;
}

export interface CardPosition {
    row: number;
    column: number;
}