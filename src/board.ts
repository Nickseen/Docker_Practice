/* Copyright (c) 2021-25 MIT 6.102/6.031 course staff, all rights reserved.
 * Redistribution of original or derived work requires permission of course staff.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import { Card, CardPosition} from './types.js';

/**
 * Mutable game board for Memory Scramble multiplayer game.
 * 
 * Board represents a rectangular grid of cards that can be flipped by multiple players.
 * Players flip cards to find matching pairs. The board is safe for concurrent access
 * by multiple players.
 */
export class Board {

    private readonly width: number;
    private readonly height: number;
    private readonly cards: Card[][]; // двумерный массив карт
    private readonly playerCards: Map<string, CardPosition[]>; // карты под контролем игроков
    private readonly previousCards: Map<string, { positions: CardPosition[], matched: boolean }>; // предыдущие карты игрока для правил 3-A/3-B
    private readonly watchers: Set<() => void>; // кто ждёт изменений (для watch)
    private readonly waitingForCard: Map<string, { resolve: () => void, position: CardPosition }[]>; // игроки, ждущие карту (правило 1-D)


    // Abstraction function:
    //   AF(width, height, cards, playerCards, previousCards, watchers, waitingForCard) = 
    //     Игровая доска Memory Scramble размером width × height клеток,
    //     где cards[row][col] представляет карту в позиции (row, col).
    //     playerCards отображает каждого игрока на список позиций карт,
    //     которые этот игрок в данный момент контролирует (0, 1 или 2 карты).
    //     previousCards отображает игрока на его предыдущие 1-2 карты и флаг matched,
    //     указывающий, совпали ли они (для применения правил 3-A/3-B при следующем ходе).
    //     watchers - набор функций, ожидающих уведомления об изменении доски.
    //     waitingForCard отображает позицию карты на список игроков, ожидающих её освобождения (правило 1-D).
        
    // Representation invariant:
    //   - width > 0 и height > 0
    //   - cards - прямоугольный массив размером height × width
    //   - cards[row][col].state ∈ {'down', 'up', 'none'} для всех row, col
    //   - каждый игрок контролирует 0, 1 или 2 карты
    //   - если карта контролируется игроком, то она существует (state ≠ 'none') и state = 'up'
    //   - никакая карта не контролируется более чем одним игроком
    //   - все позиции в playerCards и previousCards указывают на существующие клетки доски
    //   - если игрок в previousCards, то он имеет 1 или 2 позиции
    //   - если previousCards[player].matched = true, то позиций ровно 2
    
    // Safety from rep exposure:
    //   - все поля объявлены как private и/или readonly
    //   - конструктор приватный, создание только через parseFromFile
    //   - метод look() возвращает строку (immutable), а не ссылку на cards
    //   - метод flip() не возвращает ссылки на внутренние структуры
    //   - внешний код не может получить доступ к cards, playerCards, watchers

    // TODO constructor
    private constructor(width: number, height: number, cards: Card[][]) {
    this.width = width;
    this.height = height;
    this.cards = cards;
    this.playerCards = new Map();
    this.previousCards = new Map();
    this.watchers = new Set();
    this.waitingForCard = new Map();
    this.checkRep();
    }

    // TODO checkRep
    private checkRep(): void {
        assert(this.width > 0 && this.height > 0);
        assert(this.cards.length === this.height);
        assert(this.cards.every(row => row.length === this.width));
        // проверка, что каждый игрок контролирует максимум 2 карты
        for (const positions of this.playerCards.values()) {
            assert(positions.length <= 2);
        }
    }

    // TODO other methods

    /**
     * Returns the current state of the board from the perspective of a player.
     * 
     * @param playerId ID of the player viewing the board
     * @returns string representation of the board
     */
    public look(playerId: string): string {
        this.checkRep();
        
        let result = `${this.width}x${this.height}\n`;
        
        for (let row = 0; row < this.height; row++) {
            for (let col = 0; col < this.width; col++) {
                const card = this.cards[row]![col];
                assert(card !== undefined);

                if (card.state === 'none') {
                    // Карта удалена
                    result += 'none\n';
                } else if (card.controlledBy === playerId) {
                    // Карта под контролем этого игрока
                    result += `my ${card.label}\n`;
                } else if (card.state === 'up') {
                    // Карта открыта (видна всем)
                    result += `up ${card.label}\n`;
                } else {
                    // Карта закрыта
                    result += 'down\n';
                }
            }
        }
        
        this.checkRep();
        return result.trim();
    }

    /**
     * Get the positions of cards controlled by a player.
     * 
     * @param playerId ID of the player
     * @returns array of card positions controlled by this player
     */
    private getPlayerCards(playerId: string): CardPosition[] {
        return this.playerCards.get(playerId) || [];
    }

    /**
     * Flip a card on the board.
     * 
     * @param playerId ID of the player flipping the card
     * @param row row of the card
     * @param column column of the card
     * @returns updated board state from player's perspective
     * @throws Error if flip is invalid
     */
    public async flip(playerId: string, row: number, column: number): Promise<string> {
        this.checkRep();
        
        const previous = this.previousCards.get(playerId);
        if (previous) {
            if (previous.matched) {
                // Правило 3-A: удаляем совпавшие карты
                for (const pos of previous.positions) {
                    const card = this.cards[pos.row]![pos.column];
                    assert(card !== undefined);
                    if (card.state !== 'none') {
                        card.state = 'none';
                        card.controlledBy = null;
                        // Пробуждаем игроков, ждущих эту карту
                        this.wakeUpWaitingPlayers(pos);
                    }
                }
            } else {
                // Правило 3-B: закрываем несовпавшие карты 
                for (const pos of previous.positions) {
                    const card = this.cards[pos.row]![pos.column];
                    assert(card !== undefined);
                    if (card.state === 'up' && card.controlledBy === null) {
                        card.state = 'down';
                    }
                }
            }
            this.previousCards.delete(playerId);
            this.notifyWatchers();
        }
        
        if (row < 0 || row >= this.height || column < 0 || column >= this.width) {
            throw new Error('card position out of bounds');
        }

        const card = this.cards[row]![column];
        assert(card !== undefined);

        // Правило 1-A и 2-A: карта не существует
        if (card.state === 'none') {
            const myCards = this.getPlayerCards(playerId);
            
            if (myCards.length === 1) {
                // Правило 2-A: У игрока была первая карта, освобождаем её
                const firstPos = myCards[0]!;
                const firstCard = this.cards[firstPos.row]![firstPos.column];
                assert(firstCard !== undefined);
                firstCard.controlledBy = null;
                // Карта остаётся face-up (сохраняем в previousCards)
                this.previousCards.set(playerId, { positions: [firstPos], matched: false });
                this.playerCards.delete(playerId);
                this.notifyWatchers();
                throw new Error('card does not exist');
            } else if (myCards.length === 0) {
                // Правило 1-A: Игрок ждал эту карту как первую, но она исчезла
                // Это нормальная ситуация - просто возвращаем текущее состояние доски
                this.checkRep();
                return this.look(playerId);
            }
            throw new Error('card does not exist');
        }
        
        // Правило 1-D: Карта занята другим игроком - ЖДАТЬ
        if (card.controlledBy !== null && card.controlledBy !== playerId) {
            const myCards = this.getPlayerCards(playerId);
            
            // Правило 2-B: если это вторая карта, провал + освобождение первой
            if (myCards.length === 1) {
                const firstPos = myCards[0]!;
                const firstCard = this.cards[firstPos.row]![firstPos.column];
                assert(firstCard !== undefined);
                firstCard.controlledBy = null;
                // Карта остаётся face-up (сохраняем в previousCards)
                this.previousCards.set(playerId, { positions: [firstPos], matched: false });
                this.playerCards.delete(playerId);
                this.notifyWatchers();
                throw new Error('card is controlled by another player');
            }
            
            // Правило 1-D: ждём освобождения карты
            const { promise, resolve } = Promise.withResolvers<void>();
            const position = { row, column };
            
            // Сохраняем ожидающего
            const key = `${row},${column}`;
            if (!this.waitingForCard.has(key)) {
                this.waitingForCard.set(key, []);
            }
            this.waitingForCard.get(key)!.push({ resolve, position });
            
            // Ждём освобождения
            await promise;
            
            // После пробуждения повторяем попытку (рекурсия)
            return this.flip(playerId, row, column);
        }
        
        const myCards = this.getPlayerCards(playerId);
        
        // Проверка: не больше 2 карт
        if (myCards.length >= 2) {
            throw new Error('you already control 2 cards');
        }
        
        // ПЕРВАЯ КАРТА
        if (myCards.length === 0) {
            // Правило 1-B или 1-C: беру карту под контроль
            card.controlledBy = playerId;
            card.state = 'up';
            this.playerCards.set(playerId, [{ row, column }]);
            
            this.notifyWatchers();
            this.checkRep();
            return this.look(playerId);
        }
        
        // ВТОРАЯ КАРТА
        if (myCards.length === 1) {
            const firstPos = myCards[0]!;
            
            // Проверка: нельзя флипнуть ту же карту дважды
            if (firstPos.row === row && firstPos.column === column) {
                throw new Error('cannot flip the same card twice');
            }
            
            const firstCard = this.cards[firstPos.row]![firstPos.column];
            assert(firstCard !== undefined);
            
            // Правило 2-C: переворачиваем вторую карту
            card.controlledBy = playerId;
            card.state = 'up';
            
            this.notifyWatchers();
            
            // Проверка совпадения
            const matched = (firstCard.label === card.label);
            
            if (matched) {
                // Правило 2-D: совпадение - оставляем под контролем, карты face-up
                // Карты будут удалены при следующем ходе (правило 3-A)
                this.previousCards.set(playerId, { 
                    positions: [firstPos, { row, column }], 
                    matched: true 
                });
            } else {
                // Правило 2-E: не совпадают - освобождаем контроль, оставляем face-up
                firstCard.controlledBy = null;
                card.controlledBy = null;
                
                // Пробуждаем ждущих игроков для обеих карт
                this.wakeUpWaitingPlayers(firstPos);
                this.wakeUpWaitingPlayers({ row, column });
                
                // Карты останутся face-up и будут закрыты при следующем ходе (правило 3-B)
                this.previousCards.set(playerId, { 
                    positions: [firstPos, { row, column }], 
                    matched: false 
                });
            }
            
            // Освобождаем текущий контроль
            this.playerCards.delete(playerId);
            
            this.notifyWatchers();
            this.checkRep();
            return this.look(playerId);
        }
        
        this.checkRep();
        return this.look(playerId);
    }
    
    /**
     * Notify all watching players that the board has changed.
     */
    private notifyWatchers(): void {
        for (const resolve of this.watchers) {
            resolve();
        }
        this.watchers.clear();
    }
    
    /**
     * Wake up players waiting for a specific card position to become available.
     * 
     * @param position the card position that became available
     */
    private wakeUpWaitingPlayers(position: CardPosition): void {
        const key = `${position.row},${position.column}`;
        const waiting = this.waitingForCard.get(key);
        
        if (waiting && waiting.length > 0) {
            // Пробуждаем одного ждущего игрока (FIFO)
            const first = waiting.shift();
            if (first) {
                first.resolve();
            }
            
            // Если очередь пуста, удаляем ключ
            if (waiting.length === 0) {
                this.waitingForCard.delete(key);
            }
        }
    }

    /**
     * Wait for the board to change, then return the updated state.
     * 
     * @param playerId ID of the player watching
     * @returns the new state of the board after a change occurs
     */
    public async watch(playerId: string): Promise<string> {
        this.checkRep();
        
        // Создаём Promise, который выполнится при следующем изменении
        const { promise, resolve } = Promise.withResolvers<void>();
        
        // Сохраняем resolve в список ожидающих
        this.watchers.add(resolve);
        
        // Ждём изменения
        await promise;
        
        // Возвращаем обновлённое состояние
        this.checkRep();
        return this.look(playerId);
    }

    /**
     * Replace all cards on the board by applying a function to each card label.
     * Maintains pairwise consistency during replacement.
     * 
     * @param playerId ID of the player applying the map
     * @param f function to apply to each card label
     * @returns the state of the board after replacement
     */
    public async map(playerId: string, f: (card: string) => Promise<string>): Promise<string> {
        this.checkRep();
        
        // Собираем все уникальные значения карт
        const uniqueLabels = new Set<string>();
        for (let row = 0; row < this.height; row++) {
            for (let col = 0; col < this.width; col++) {
                const card = this.cards[row]![col];
                assert(card !== undefined);
                if (card.state !== 'none') {
                    uniqueLabels.add(card.label);
                }
            }
        }
        
        // Вычисляем новые значения для каждой уникальной метки
        const mapping = new Map<string, string>();
        for (const label of uniqueLabels) {
            mapping.set(label, await f(label));
        }
        
        // Применяем замену АТОМАРНО (все сразу)
        for (let row = 0; row < this.height; row++) {
            for (let col = 0; col < this.width; col++) {
                const card = this.cards[row]![col];
                assert(card !== undefined);
                if (card.state !== 'none') {
                    const newLabel = mapping.get(card.label);
                    if (newLabel !== undefined) {
                        card.label = newLabel;
                    }
                }
            }
        }
        
        this.notifyWatchers();
        this.checkRep();
        return this.look(playerId);
    }

    /**
     * Make a new board by parsing a file.
     * 
     * PS4 instructions: the specification of this method may not be changed.
     * 
     * @param filename path to game board file
     * @returns a new board with the size and cards from the file
     * @throws Error if the file cannot be read or is not a valid game board
     */
    public static async parseFromFile(filename: string): Promise<Board> {
        const content = await fs.promises.readFile(filename, 'utf-8');
        const lines = content.trim().split('\n');
        if (lines.length === 0 || !lines[0]) {
            throw new Error('empty board file');
        }
        
        // Парсим размер
        const [widthStr, heightStr] = lines[0].split('x');
        if (!widthStr || !heightStr) {
            throw new Error('invalid board format: expected WxH');
        }
        const width = parseInt(widthStr);
        const height = parseInt(heightStr);
        
        // Читаем карты
        const cardLabels = lines.slice(1); // все строки кроме первой
        
        // Создаём двумерный массив
        const cards: Card[][] = [];
        let index = 0;
        for (let row = 0; row < height; row++) {
            const cardRow: Card[] = [];
            for (let col = 0; col < width; col++) {
                const label = cardLabels[index];
                if (!label) {
                    throw new Error('not enough card labels in board file');
                }
                cardRow.push({
                    label: label.trim(),
                    state: 'down',
                    controlledBy: null
                });
                index++;
            }
            cards.push(cardRow);
        }
        
        return new Board(width, height, cards);
    }
}
