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
    private readonly watchers: Set<() => void>; // кто ждёт изменений (для watch)


    // Abstraction function:
    //   AF(width, height, cards, playerCards, watchers) = 
    //     Игровая доска Memory Scramble размером width × height клеток,
    //     где cards[row][col] представляет карту в позиции (row, col).
    //     playerCards отображает каждого игрока на список позиций карт,
    //     которые этот игрок в данный момент контролирует.
    //     watchers - набор функций, ожидающих уведомления об изменении доски.
        
    // Representation invariant:
    //   - width > 0 и height > 0
    //   - cards - прямоугольный массив размером height × width
    //   - cards[row][col].state ∈ {'down', 'up', 'none'} для всех row, col
    //   - каждый игрок контролирует 0, 1 или 2 карты
    //   - если карта контролируется игроком, то она существует (state ≠ 'none')
    //   - никакая карта не контролируется более чем одним игроком
    //   - все позиции в playerCards указывают на существующие клетки доски
    
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
    this.watchers = new Set();
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
