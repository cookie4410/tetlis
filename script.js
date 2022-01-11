"use strict";

const VERSION = "ver.0.1.4"

// キャンバス情報取得
const CANVAS = document.getElementById("tet_field");
const CONTEXT = CANVAS.getContext("2d");

// テトリミノ関連定数
const MINOS = [
  // 各ミノのブロック座標
  [0, 0, 0, 0, 0, 0, 0, 0], // none
  [0, 1, 1, 0, 1, 1, 1, 2], // T
  [0, 1, 0, 2, 1, 0, 1, 1], // S
  [0, 0, 0, 1, 1, 1, 1, 2], // Z
  [0, 2, 1, 0, 1, 1, 1, 2], // L
  [0, 0, 1, 0, 1, 1, 1, 2], // J
  [0, 1, 0, 2, 1, 1, 1, 2], // O
  [1, 0, 1, 1, 1, 2, 1, 3], // I
];
const BC_LIST = [
  // 各ミノの色コード
  "#777", //ghost
  "#6b2ee6", //T
  "#3dcc3d", //S
  "#e61717", //Z
  "#e65c17", //L
  "#3333ff", //J
  "#e6e645", //O
  "#4de7ff", //I
  "#999", //wall
];
const BLOCK_SIZE = 20; // ブロックの縦横幅

// フィールド関連定数
const FIELD_ROW = 23; // フィールドの行数（20行 + 壁 + 画面外）
const FIELD_COL = 12; // フィールドの列数（10行 + 壁）
const FIELD_TEMPLATE = [8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8]; // フィールドのテンプレート

// キャンバス関連定数
const CANVAS_W = BLOCK_SIZE * FIELD_COL * 2; // キャンバスの横幅を計算
const CANVAS_H = BLOCK_SIZE * (FIELD_ROW - 2) + BLOCK_SIZE / 2; // キャンバスの縦幅を計算
const MARGIN = (BLOCK_SIZE * FIELD_COL) / 2; // ゲーム時のマージンを計算

// 各種初期値
const DEFAULT_SPEED = 1000; // デフォルトのゲームスピード
class InitialKeys {
  // デフォルトのキー配置
  constructor() {
    this.move_L = "ArrowLeft";
    this.move_R = "ArrowRight";
    this.softDrop = "ArrowDown";
    this.hardDrop = "ArrowUp";
    this.rotate_L = "a";
    this.rotate_R = "d";
    this.hold = "Shift";
  }
}

class highScore {
  constructor() {
    this.name = '___';
    this.level = 0;
    this.lines = 0;
    this.score = 0;
  }
}
class InitialStats {
  // デフォルトの成績ステータス
  constructor() {
    this.score = 0;
    this.level = 1;
    this.lines = 0;
  }
}

class InitialKeyStatus {
  constructor() {
    this.move_L = false;
    this.move_L_t = 0;
    this.move_R = false;
    this.move_R_t = 0;
    this.softDrop = false;
    this.softDrop_t = 0;
    this.useDAS = false; // DASフラグ
    this.DAStime = 0; // DAS突入時間
  }
}

class InitialDatas {
  constructor() {
    this.selectPos = 0; // メニュー時選択箇所
    this.startTime = performance.now(); // ループ開始時間
    this.minoBag = []; // ミノバッグ
    this.frameCount = 0; // ループ時のフレームカウント
    this.mino_x = 0; // 現在ミノのX座標
    this.mino_y = 0; // 現在ミノのY座標
    this.hold = 0; // ホールド中のミノ番号
    this.useHold = false; // ホールド使用済フラグ
    this.gameSpeed = DEFAULT_SPEED; // 現在のゲームスピード
    this.stats = new InitialStats(); // 現在の成績
    this.fixedCol = []; // ミノ固定ポジション
    this.alignLine = []; // 揃ったライン
    this.pointMes = ''; // 加点メッセージ文(組立用)
    this.compPointMes = ''; // 加点メッセージ文(完成版)
    this.additionPoint = 0; // 得点の合計加算値
    this.useSpin = false; // 直近の操作が回転かのフラグ
    this.useTSpin = false; // TSpinフラグ
    this.useTSpinMini = false; //TSpinミニフラグ
    this.srsPattern = 0; // SRSパターン
    this.fixTime = []; // ミノ固定エフェクト開始時間
    this.btb = false; // BtBフラグ
    this.btbFlag = false; // 前回のBtBフラグ
    this.ren = 0; // RENカウント
    this.perfect = false; // パーフェクトクリアフラグ
    this.keyStatus = new InitialKeyStatus(); // キー押下フラグ
    this.actionCount = 0; // 行動回数
    this.lowestRow = 0;
    this.delayTime = 0; // ロックディレイ開始時間
    this.onGround = false; // 接地フラグ
    this.gameOverTime = 0; // ゲームクリア時間
    this.result = ''; // ゲーム結果
    this.hsFlag = ''; // ハイスコアフラグ
    this.mode = ''; // ゲームモード
  }
}

const DAS_FRAME = 11;
const ARR_FRAME = 2;
const MAX_ACTION = 8;

// グローバル変数定義
let datas = new InitialDatas();
let situation = "TITLE"; // ゲームモード
let confirmPos = 1; // 確認時選択箇所
let field = []; // フィールドマップデータ
let currentMino; // 現在ミノのマップデータ
let minoLength; // 現在ミノの長さ
let minoNum; // 現在ミノの番号
let direction; // 現在ミノの方角
let oldKeys = {}; // キーコンフィグ時の待避所
let oldKey = ""; // キーコンフィグ時の待避所
let keys = new InitialKeys(); // 現在のキーコンフィグ
let clearTime; // ライン消去エフェクト開始時間
let mesTime = 0; // 加点メッセージ生成時間
let pauseTime; // ポーズした時間
let allCookies = getCookies(); // クッキーの連想配列
let highScores = { // ハイスコアデータ
  normal: {
    hs1: new highScore(),
    hs2: new highScore(),
    hs3: new highScore(),
    hs4: new highScore(),
    hs5: new highScore()
  }
}
let userName = '___'; // ハイスコア用ユーザ－名
let configPromptMode = false; // キーコンフィグ入力待機
let confirmMode = 'none'; // 確認ボックスの用途
let diagText = ''; // 確認ボックス用ダイアログメッセージ
let resultSwitch = true; // リザルト画面のスイッチ
let hsSwitch = true; // ハイスコア画面のスイッチ

// キャンバス描画サイズ指定
CANVAS.setAttribute("width", CANVAS_W);
CANVAS.setAttribute("height", CANVAS_H);

// フィールドマップの二次元配列を生成
function buildFieldMap() {
  let newField = field;
  while (newField.length < FIELD_ROW - 1) {
    newField.unshift(FIELD_TEMPLATE.slice());
  }
  newField.push([8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8]);
  return newField;
}

// ミノデータから二次元配列を作成
function buildMinoMap(num, rotate) {
  let count = 0;
  let minoMap = [];
  let minoData = MINOS[num];
  let len;
  // I型ミノ分岐
  if (num === 7 && rotate === true) {
    while (minoMap.length < 4) {
      let defaultRow = [0, 0, 0, 0];
      minoMap.unshift(defaultRow.slice());
    }
    return minoMap;
  } else if (rotate === true) {
    num = 0;
  }
  if (num != 7) {
    len = 3;
  } else {
    len = 4;
  }
  for (let i = 0; i < len; i++) {
    minoMap.push([]);
    for (let j = 0; j < len; j++) {
      if (minoData[count] === i && minoData[count + 1] === j) {
        minoMap[i].push(num);
        count += 2;
      } else {
        minoMap[i].push(0);
      }
    }
  }
  return minoMap;
}

// ブロックを描画
function drawBlock(x, y, blockNum) {
  let blockColor = BC_LIST[blockNum];
  CONTEXT.beginPath();
  CONTEXT.fillStyle = blockColor;
  CONTEXT.rect(x + MARGIN, y - BLOCK_SIZE * 1.5, BLOCK_SIZE, BLOCK_SIZE);
  CONTEXT.fill();
  CONTEXT.strokeStyle = "#222";
  CONTEXT.lineWidth = "0.5";
  CONTEXT.stroke();
}

function drawGrid(x, y) {
  CONTEXT.beginPath();
  CONTEXT.rect(x + MARGIN, y - BLOCK_SIZE * 1.5, BLOCK_SIZE, BLOCK_SIZE);
  CONTEXT.strokeStyle = "#555";
  CONTEXT.lineWidth = "0.1";
  CONTEXT.stroke();
}

// テトリミノを描画
function drawMino() {
  let length = calcMinoLength(minoNum);
  for (let i = 0; i < length; i++) {
    for (let j = 0; j < length; j++) {
      if (currentMino[i][j]) {
        drawBlock(
          (datas.mino_x + j) * BLOCK_SIZE,
          (datas.mino_y + i) * BLOCK_SIZE,
          currentMino[i][j]
        );
      }
    }
  }
}

// フィールドを描画
function drawField() {
  for (let i = 1; i < FIELD_ROW; i++) {
    for (let j = 0; j < FIELD_COL; j++) {
      if (field[i][j]) {
        drawBlock(j * BLOCK_SIZE, i * BLOCK_SIZE, field[i][j]);
      } else {
        drawGrid(j * BLOCK_SIZE, i * BLOCK_SIZE);
      }
    }
  }
}

// ゴーストを描画
function drawGhost() {
  let ghost_y = 0;
  for (let i = 1; checkMove(0, i); i++) {
    ghost_y = i;
  }
  for (let i = 0; i < minoLength; i++) {
    for (let j = 0; j < minoLength; j++) {
      if (currentMino[i][j]) {
        drawBlock(
          (datas.mino_x + j) * BLOCK_SIZE,
          (ghost_y + datas.mino_y + i) * BLOCK_SIZE,
          0
        );
      }
    }
  }
}

// 判定ラインを描画
function drawLine() {
  CONTEXT.beginPath();
  CONTEXT.moveTo(MARGIN, BLOCK_SIZE / 2);
  CONTEXT.lineTo(FIELD_COL * BLOCK_SIZE + MARGIN, BLOCK_SIZE / 2);
  CONTEXT.strokeStyle = "#999";
  CONTEXT.lineWidth = 1;
  CONTEXT.stroke();
}

// 塗りつぶし文字を描画
function drawFillText(t, x, y, size, color, weight) {
  CONTEXT.font = `${weight} ${size}px "Press Start 2P"`;
  CONTEXT.fillStyle = color;
  let w = CONTEXT.measureText(t).width;
  x = CANVAS_W / 2 - w / 2 + x;
  y = CANVAS_H / 2 + y;
  CONTEXT.fillText(t, x, y);
}

// 枠線文字を描画
function drawStrokeText(t, x, y, size, color, weight) {
  CONTEXT.font = `${weight} ${size}px "Press Start 2P"`;
  CONTEXT.lineWidth = 0.1;
  CONTEXT.strokeStyle = color;
  let w = CONTEXT.measureText(t).width;
  x = CANVAS_W / 2 - w / 2 + x;
  y = CANVAS_H / 2 + y;
  CONTEXT.strokeText(t, x, y);
}

// 各種窓枠を描画
function drawWindows() {
  let x = 10 + MARGIN * 3;
  let y = 10;
  CONTEXT.lineWidth = 1;
  CONTEXT.strokeStyle = "#ddd";
  drawRadialRect(x, y, BLOCK_SIZE * 5, BLOCK_SIZE * 5, 10, "#ddd");
  drawRadialRect(10, y, BLOCK_SIZE * 5, BLOCK_SIZE * 5, 10, "#ddd");
  CONTEXT.font = 'bold 15px "Press Start 2P"';
  CONTEXT.fillStyle = "#ddd";
  CONTEXT.fillText("NEXT", x + 10, 35);
  CONTEXT.fillText("HOLD", 20, 35);
  for (let i = 0; i <= 4; i++) {
    drawRadialRect(
      x,
      BLOCK_SIZE * (5 + i * 3) + y * 2,
      BLOCK_SIZE * 4,
      BLOCK_SIZE * 2.4,
      10,
      "#ddd"
    );
  }
}

// 角丸四角形を描画
function drawRadialRect(x, y, w, h, r, color) {
  CONTEXT.beginPath();
  CONTEXT.lineWidth = 1;
  CONTEXT.strokeStyle = color;
  CONTEXT.moveTo(x, y + r);
  CONTEXT.arc(x + r, y + h - r, r, Math.PI, Math.PI * 0.5, true);
  CONTEXT.arc(x + w - r, y + h - r, r, Math.PI * 0.5, 0, 1);
  CONTEXT.arc(x + w - r, y + r, r, 0, Math.PI * 1.5, 1);
  CONTEXT.arc(x + r, y + r, r, Math.PI * 1.5, Math.PI, 1);
  CONTEXT.closePath();
  CONTEXT.stroke();
}

// 次のミノを描画
function drawNextMino() {
  if (datas.minoBag.length < 7) {
    datas.minoBag = datas.minoBag.concat(genBag());
  }
  let nextMino = buildMinoMap(datas.minoBag[0]);
  let length = calcMinoLength(datas.minoBag[0]);
  let x = 0;
  let y = 0;
  for (let i = 0; i < length; i++) {
    for (let j = 0; j < length; j++) {
      if (nextMino[i][j]) {
        if (datas.minoBag[0] <= 5) {
          x = BLOCK_SIZE / 2;
        } else if (datas.minoBag[0] === 7) {
          y = -1 * (BLOCK_SIZE / 2);
        }
        drawBlock(
          x + (13 + j) * BLOCK_SIZE,
          y + (4 + i) * BLOCK_SIZE,
          nextMino[i][j]
        );
      }
    }
  }
}

// 2～5個先のミノを描画
function drawProspect() {
  if (datas.minoBag.length < 7) {
    datas.minoBag = datas.minoBag.concat(genBag());
  }
  for (let i = 0; i < 5; i++) {
    drawSmallMino(i);
  }
}

// ホールドを描画
function drawHold() {
  if (datas.hold != 0 && datas.useHold === false) {
    drawHoldMino(datas.hold);
  } else if (datas.hold != 0) {
    drawHoldMino(0);
  }
}

// ホールドミノを描画
function drawHoldMino(color) {
  let holdMino = buildMinoMap(datas.hold);
  let length = calcMinoLength(datas.hold);
  let x = 0;
  let y = 0;
  for (let i = 0; i < length; i++) {
    for (let j = 0; j < length; j++) {
      if (holdMino[i][j]) {
        if (datas.hold <= 5) {
          x = BLOCK_SIZE / 2;
        } else if (datas.hold === 7) {
          y = -1 * (BLOCK_SIZE / 2);
        }
        drawBlock(x + (-5 + j) * BLOCK_SIZE, y + (4 + i) * BLOCK_SIZE, color);
      }
    }
  }
}

// ブロックを描画（サイズ小）
function drawSmallBlock(x, y, blockNum) {
  let blockColor = BC_LIST[blockNum];
  let blockSize = BLOCK_SIZE * 0.8;
  CONTEXT.beginPath();
  CONTEXT.fillStyle = blockColor;
  CONTEXT.rect(x + MARGIN, y - BLOCK_SIZE * 1.5, blockSize, blockSize);
  CONTEXT.fill();
  CONTEXT.strokeStyle = "#222";
  CONTEXT.lineWidth = "1";
  CONTEXT.stroke();
}

// ミノを描画（サイズ小）
function drawSmallMino(num) {
  let targetNum = datas.minoBag[num + 1];
  let targetMino = buildMinoMap(targetNum);
  let length = calcMinoLength(targetNum);
  let x = 0;
  let y = num * BLOCK_SIZE * 3;
  for (let i = 0; i < length; i++) {
    for (let j = 0; j < length; j++) {
      if (targetMino[i][j]) {
        if (targetNum <= 5) {
          x = (BLOCK_SIZE / 2) * 0.8;
        } else if (targetNum === 7) {
          y = -1 * ((BLOCK_SIZE / 2) * 0.8) + num * BLOCK_SIZE * 3;
        }
        drawSmallBlock(
          x + 12 * BLOCK_SIZE + (j + 1.1) * BLOCK_SIZE * 0.8,
          y + BLOCK_SIZE * 7.5 + (i + 0.5) * BLOCK_SIZE * 0.8,
          targetMino[i][j]
        );
      }
    }
  }
}

// 成績を描画
function drawStatus() {
  drawRadialRect(10, 20 + BLOCK_SIZE * 5, BLOCK_SIZE * 5, 150, 10, "#ddd");
  CONTEXT.font = '10px "Press Start 2P"';
  CONTEXT.fillStyle = "#ddd";
  const X = 20;
  const Y = 40 + BLOCK_SIZE * 5;
  let ny;
  let t;
  for (let p in datas.stats) {
    switch (p) {
      case "level":
        ny = Y;
        break;
      case "lines":
        ny = Y + 50;
        break;
      case "score":
        ny = Y + 100;
        break;
    }
    if (datas.stats[p] > 99999999) {
      t = '9999999+';
    } else {
      t = datas.stats[p];
    }
    CONTEXT.textAlign = "end";
    CONTEXT.fillText(t, BLOCK_SIZE * 5, ny + 20);
    CONTEXT.textAlign = "start";
    CONTEXT.fillText(p, X, ny);
  }
}

// 加点メッセージを描画
function drawPointMes() {
  let elapsedTime = performance.now() - mesTime;
  if (elapsedTime < 2000) {
    let tlist = datas.compPointMes.split('\n');
    for (let i = 0; i < tlist.length; i++) {
      drawFillText(tlist[i], -180, 90 + i * 18, 14, '#ddd', 'normal');
    }
  }
}

// 列消去エフェクトを描画
function drawClearEffect() {
  let alpha = 1 - (performance.now() - clearTime) / 500;
  CONTEXT.fillStyle = `rgba(221, 221, 221, ${alpha})`;
  for (let i of datas.alignLine) {
    CONTEXT.fillRect(MARGIN + BLOCK_SIZE, (i - 1.5) * BLOCK_SIZE, BLOCK_SIZE * (FIELD_COL - 2), BLOCK_SIZE)
  }
}

// ミノ固定エフェクトを描画
function drawFixEffect() {
  let count = 0;
  let del = 0;
  for (let li of datas.fixedCol) {
    let elapsedTime = performance.now() - datas.fixTime[count]
    let y_list = [];
    for (let i = 0; i < li.length; i += 2) {
      if (!y_list.includes(li[i + 1])) {
        let grad = CONTEXT.createLinearGradient(0, 0, 0, (li[i] + 1) * BLOCK_SIZE)
        let alpha = 34 + 187 * (1 - elapsedTime / 500)
        grad.addColorStop(0.0, 'rgb(34, 34, 34)');
        grad.addColorStop(1.0, `rgb(${alpha}, ${alpha}, ${alpha})`);
        CONTEXT.fillStyle = grad;
        CONTEXT.fillRect(li[i + 1] * BLOCK_SIZE + MARGIN, 0, BLOCK_SIZE, (li[i] - 1.5) * BLOCK_SIZE)
        y_list.push(li[i + 1]);
      }
    }
    if (elapsedTime >= 500) {
      del++;
    }
    count++;
  }
  datas.fixedCol.splice(0, del);
  datas.fixTime.splice(0, del);
}

// ゲーム画面をまとめて描画
function drawAll() {
  CONTEXT.clearRect(0, 0, CANVAS.width, CANVAS.height);
  CONTEXT.beginPath();
  CONTEXT.fillStyle = "#222";
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  drawFixEffect();
  drawField();
  drawGhost();
  drawMino();
  drawLine();
  drawWindows();
  drawNextMino();
  drawProspect();
  drawHold();
  drawStatus();
  drawPointMes();
}

// ミノバッグを生成
function genBag() {
  let newBag = new Array(7);
  let serialNum = 1;
  for (let i = 0; i < newBag.length; i++) {
    newBag[i] = serialNum;
    serialNum++;
  }
  for (let i = newBag.length; i > 1; i--) {
    let target = Math.floor(Math.random() * i);
    [newBag[target], newBag[i - 1]] = [newBag[i - 1], newBag[target]];
  }
  return newBag;
}

// ミノの長さを計算
function calcMinoLength(num) {
  let lenth;
  switch (num) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
      length = 3;
      break;
    case 7:
      length = 4;
      break;
  }
  return length;
}

// 新規ミノ出現
function spawnMino() {
  if (datas.minoBag.length === 0) {
    datas.minoBag = genBag();
  }
  minoNum = datas.minoBag.shift();
  currentMino = buildMinoMap(minoNum);
  minoLength = calcMinoLength(minoNum);
  datas.mino_x = 4;
  datas.mino_y = 0;
  direction = 0;
  datas.spawnTime = performance.now();
  checkCollision();
}

// 衝突判定
function checkMove(x, y, newMino) {
  if (newMino === undefined) {
    newMino = currentMino;
  }
  let new_x;
  let new_y;
  for (let i = 0; i < minoLength; i++) {
    for (let j = 0; j < minoLength; j++) {
      if (newMino[i][j]) {
        new_x = datas.mino_x + x + j;
        new_y = datas.mino_y + y + i;
        if (
          new_x < 0 ||
          new_x >= FIELD_COL ||
          new_y >= FIELD_ROW ||
          field[new_y][new_x]
        ) {
          return false;
        }
      }
    }
  }
  return true;
}

// 回転処理
function rotateMino(key) {
  let rotated = false;
  let newMinoMap = buildMinoMap(minoNum, true);
  for (let i = 0; i < minoLength; i++) {
    for (let j = 0; j < minoLength; j++) {
      if (key === keys.rotate_L) {
        if (currentMino[j][minoLength - 1 - i]) {
          newMinoMap[i][j] = currentMino[j][minoLength - 1 - i];
        }
      } else {
        if (currentMino[minoLength - 1 - j][i]) {
          newMinoMap[i][j] = currentMino[minoLength - 1 - j][i];
        }
      }
    }
  }
  if (checkMove(0, 0, newMinoMap)) {
    currentMino = newMinoMap;
    rotated = true;
  } else {
    rotated = srs(key, newMinoMap);
  }
  return rotated;
}

// TSpin成否チェック
function checkTSpin() {
  let count = 0;
  const CHECK_POINT = [0, 0, 0, 2, 2, 0, 2, 2];
  let checkMini = false;
  let pointStats = '';
  for (let i = 0; i < 8; i += 2) {
    if (field[datas.mino_y + CHECK_POINT[i]][datas.mino_x + CHECK_POINT[i + 1]]) {
      count++;
      pointStats += '1';
    } else {
      pointStats += '0';
    }
  }
  if (count === 3) {
    let target;
    switch (direction) {
      case 0:
        target = ['1011', '0111'];
        break;
      case 1:
        target = ['1011', '1110'];
        break;
      case 2:
        target = ['1101', '1110'];
        break;
      case 3:
        target = ['0111', '1101'];
        break;
    }
    if (target.includes(pointStats)) {
      checkMini = true;
    }
  }
  if (count >= 3 && datas.useSpin) {
    datas.useTSpin = true;
    if (checkMini && datas.srsPattern != 4) {
      datas.useTSpinMini = true;
    }
  }
  datas.srsPattern = 0;
}

// スーパーローテーション処理
function srs(key, newMino) {
  let srsPosition = [];
  datas.srsPattern = 0;
  if (key === "a") {
    if (minoNum === 7) {
      switch (direction) {
        case 0:
          srsPosition = [-1, 0, 2, 0, -1, -2, 2, 1];
          break;
        case 1:
          srsPosition = [2, 0, -1, 0, 2, -1, -1, 2];
          break;
        case 2:
          srsPosition = [1, 0, -2, 0, 1, 2, -2, -1];
          break;
        case 3:
          srsPosition = [1, 0, -2, 0, -2, 1, 1, -2];
          break;
      }
    } else {
      switch (direction) {
        case 0:
          srsPosition = [1, 0, 1, -1, 0, 2, 1, 2];
          break;
        case 1:
          srsPosition = [1, 0, 1, 1, 0, -2, 1, -2];
          break;
        case 2:
          srsPosition = [-1, 0, -1, -1, 0, 2, -1, 2];
          break;
        case 3:
          srsPosition = [-1, 0, -1, 1, 0, -2, -1, -2];
          break;
      }
    }
  } else {
    if (minoNum === 7) {
      switch (direction) {
        case 0:
          srsPosition = [-2, 0, 1, 0, -2, 1, 1, -2];
          break;
        case 1:
          srsPosition = [-1, 0, 2, 0, -1, -2, 2, 1];
          break;
        case 2:
          srsPosition = [2, 0, -1, 0, 2, -1, -1, 2];
          break;
        case 3:
          srsPosition = [-2, 0, 1, 0, 1, 2, -2, -1];
          break;
      }
    } else {
      switch (direction) {
        case 0:
          srsPosition = [-1, 0, -1, -1, 0, 2, -1, 2];
          break;
        case 1:
          srsPosition = [1, 0, 1, 1, 0, -2, 1, -2];
          break;
        case 2:
          srsPosition = [1, 0, 1, -1, 0, 2, 1, 2];
          break;
        case 3:
          srsPosition = [-1, 0, -1, 1, 0, -2, -1, -2];
          break;
      }
    }
  }
  for (let i = 0; i <= 6; i += 2) {
    datas.srsPattern++;
    if (checkMove(srsPosition[i], srsPosition[i + 1], newMino)) {
      currentMino = newMino;
      datas.mino_x += srsPosition[i];
      datas.mino_y += srsPosition[i + 1];
      return true;
    }
  }
  return false;
}

// ロックディレイ
function checkLockDelay() {
  if (datas.onGround) {
    let dt = performance.now() - datas.delayTime;
    if (datas.actionCount >= MAX_ACTION || dt >= 500) {
      datas.actionCount = 0;
      datas.delayTime = 0;
      datas.onGround = false;
      return true;
    }
  }
  return false;
}

// ミノをフィールドに固定
function fixMino() {
  checkLineOver();
  let li = [];
  for (let i = 0; i < minoLength; i++) {
    for (let j = 0; j < minoLength; j++) {
      if (currentMino[i][j]) {
        field[datas.mino_y + i][datas.mino_x + j] = minoNum;
        li.push(datas.mino_y + i, datas.mino_x + j);
      }
    }
  }
  datas.fixedCol.push(li);
  datas.fixTime.push(performance.now());
  checkLine();
  if (datas.alignLine.length > 0) {
    datas.ren++;
    clearLine();
  } else {
    datas.ren = 0;
  }
  checkPerfect();
  calcTSpinPoint();
  calcPoint();
  calcTotalPoint();
  datas.useHold = false;
  spawnMino();
}

// 自動落下
function dropMino() {
  if (checkMove(0, 1)) {
    datas.useSpin = false;
    datas.mino_y++;
    if (!checkMove(0, 1)) {
      if (!datas.onGround) {
        datas.delayTime = performance.now();
      }
      datas.lowestRow = datas.mino_y;
      datas.onGround = true;
    } else if (datas.onGround) {
      if (datas.lowestRow <= datas.mino_y){
        datas.actionCount = 0;
      }
      datas.onGround = false;
    }
  }
}

// ハードドロップ
function hardDrop() {
  let ghost_y = 0;
  for (let i = 1; checkMove(0, i); i++) {
    ghost_y = i;
  }
  datas.stats.score += ghost_y * 2;
  datas.mino_y += ghost_y;
  datas.actionCount = 0;
  datas.delayTime = 0;
  datas.onGround = false;
  fixMino();
}

// ホールド入れ替え
function swapHold() {
  if (datas.useHold === false) {
    if (datas.hold === 0) {
      datas.hold = minoNum;
      spawnMino();
    } else {
      [datas.hold, minoNum] = [minoNum, datas.hold];
      currentMino = buildMinoMap(minoNum);
      minoLength = calcMinoLength(minoNum);
      datas.mino_x = 4;
      datas.mino_y = 0;
      direction = 0;
    }
    datas.actionCount = 0;
    datas.delayTime = 0;
    datas.onGround = false;
    datas.useHold = true;
  }
}

// ライン完成判定
function checkLine() {
  for (let i = 1; i < FIELD_ROW - 1; i++) {
    for (let j = 1; j < FIELD_COL - 1; j++) {
      if (field[i][j]) {
        if (j === field[i].length - 2) {
          datas.alignLine.push(i);
        }
      } else {
        break;
      }
    }
  }
}

// 加点メッセージを生成
function calcTSpinPoint() {
  if (datas.useTSpin) {
    datas.pointMes += 'T-Spin\n';
    if (datas.alignLine.length > 0) {
      if (!datas.useTSpinMini) {
        datas.additionPoint += (datas.alignLine.length * 200 + 500) * (datas.stats.level);
      }
    }
  }
  if (datas.useTSpinMini) {
    datas.pointMes += 'Mini\n';
    datas.additionPoint += 100 * (datas.stats.level);
  }
  if (datas.useTSpin && datas.alignLine.length === 0) {
    datas.pointMes += 'Zero\n'
    if (!datas.useTSpinMini) {
      datas.additionPoint += 400 * (datas.stats.level);
    }
  }
  if (datas.useSpin && datas.alignLine.length > 0) {
    datas.btb = true;
  }
  datas.useTSpin = false;
  datas.useTSpinMini = false;
}

// ライン消去点を計算
function calcPoint() {
  let pBonus = 0;
  switch (datas.alignLine.length) {
    case 1:
      datas.pointMes += 'SINGLE\n';
      datas.additionPoint += 100 * (datas.stats.level);
      pBonus = 800 * (datas.stats.level);
      break;
    case 2:
      datas.pointMes += 'DOUBLE\n';
      datas.additionPoint += 300 * (datas.stats.level);
      pBonus = 1200 * (datas.stats.level);
      break;
    case 3:
      datas.pointMes += 'TRIPLE\n';
      datas.additionPoint += 500 * (datas.stats.level);
      pBonus = 1800 * (datas.stats.level);
      break;
    case 4:
      datas.pointMes += 'TETRiS\n';
      datas.btb = true;
      datas.additionPoint += 800 * (datas.stats.level);
      pBonus = 2000 * (datas.stats.level);
      break;
  }
  if (datas.perfect) {
    datas.additionPoint += pBonus;
    datas.pointMes += 'PERFECT\n';
  }
}

// 合計得点を計算
function calcTotalPoint() {
  if (datas.additionPoint) {
    if (datas.btb && datas.btbFlag) {
      datas.additionPoint = Math.round(datas.additionPoint * 1.5);
      if (datas.perfect && datas.alignLine.length === 4) {
        datas.additionPoint += 1200 * (datas.stats.level);
      }
      datas.pointMes += 'BtB\n';
    } else if (datas.btb) {
      datas.btbFlag = true;
    }
    datas.btb = false;
    if (datas.ren > 1) {
      datas.additionPoint += (datas.ren - 1) * 50 * (datas.stats.level);
      datas.pointMes += `REN ${datas.ren - 1}\n`
    } else if (datas.ren > 21) {
      datas.additionPoint += 1000 * (datas.stats.level);
      datas.pointMes += 'REN 20+\n'
    }
    datas.compPointMes = datas.pointMes + datas.additionPoint;
    datas.stats.score += datas.additionPoint;
    mesTime = performance.now();
  }
  datas.pointMes = '';
  datas.additionPoint = 0;
}

// ライン消去
function clearLine() {
  situation = "CLEAR_EFFECT";
  clearTime = performance.now();
  for (let line of datas.alignLine) {
    field[line] = (FIELD_TEMPLATE.slice());
  }
}

// レベルアップ
function levelUp() {
  if (datas.stats.lines >= datas.stats.level * 10) {
    datas.stats.level++;
    datas.startTime = performance.now();
    datas.frameCount = 0;
  }
}

// ゲームクリアチェック
function checkGameClear() {
  if (datas.stats.lines >= 150) {
    situation = "GAME_OVER_EFFECT";
    datas.result = 'CLEAR';
    datas.gameOverTime = performance.now();
  }
}

// パーフェクトクリアチェック
function checkPerfect() {
  datas.perfect = true;
  for (let i = 1; i < FIELD_ROW - 1; i++) {
    for (let j = 1; j < FIELD_COL - 1; j++) {
      if (field[i][j]) {
        datas.perfect = false;
      }
    }
  }
}

// ライン超えゲームオーバー判定
function checkLineOver() {
  let lineOverCount = 0;
  for (let i = 0; i < minoLength; i++) {
    for (let j = 0; j < minoLength; j++) {
      if (currentMino[i][j]) {
        if (datas.mino_y + i <= 1) {
          lineOverCount++;
          if (lineOverCount === 4) {
            situation = "GAME_OVER_EFFECT";
            datas.result = "OVER";
            datas.gameOverTime = performance.now();
            return;
          }
        }
      }
    }
  }
}

// 干渉ゲームオーバー判定
function checkCollision() {
  for (let i = 0; i < minoLength; i++) {
    for (let j = 0; j < minoLength; j++) {
      if (currentMino[i][j]) {
        if (field[datas.mino_y + i][datas.mino_x + j]) {
          situation = "GAME_OVER_EFFECT";
          datas.result = "OVER";
          datas.gameOverTime = performance.now();
          return;
        }
      }
    }
  }
}

// 各種変数の初期化
function initialize(sit) {
  situation = sit;
  datas = new InitialDatas();
  field = [];
  field = buildFieldMap();
}

// タイトル画面描画
function drawTitle() {
  CONTEXT.clearRect(0, 0, CANVAS.width, CANVAS.height);
  CONTEXT.beginPath();
  CONTEXT.fillStyle = "#222";
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  drawStrokeText("TETLiS", 0, -60, 70, "#ddd", "bold");
  drawFillText("NORMAL GAME", 0, 0, 20, "#ddd", "bold");
  drawFillText("HiGH SCORES", 0, 30, 20, "#ddd", "bold");
  drawFillText("KEY CONFiG", 0, 60, 20, "#ddd", "bold");
  drawFillText("Press ENTER to start!", 0, 130, 20, "#ddd", "bold");
  drawFillText("->", -140, datas.selectPos * 30, 20, "#ddd", "bold");
  drawFillText(VERSION, 170, 200, 12, '#ddd', 'normal');
}

// ポーズメニュー描画
function drawPause() {
  CONTEXT.fillStyle = "rgba(34, 34, 34, 0.8)"
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  drawFillText("PAUSE", 0, -60, 70, "#222", "bold");
  drawStrokeText("PAUSE", 0, -60, 70, "#ddd", "bold");
  drawFillText("RETURN", 0, 0, 20, "#ddd", "bold");
  drawFillText("RESTART", 0, 30, 20, "#ddd", "bold");
  drawFillText("TiTLE", 0, 60, 20, "#ddd", "bold");
  drawFillText("->", -100, datas.selectPos * 30, 20, "#ddd", "bold");
}

// ゲーム終了画面描画
function drawGameOverEffect() {
  let now = performance.now();
  for (let i = 0; i < FIELD_ROW; i++) {
    let alpha = i * -0.05 + (now - datas.gameOverTime) / 500;
    CONTEXT.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    CONTEXT.fillRect(0, (FIELD_ROW - i - 1.5) * BLOCK_SIZE, CANVAS_W, BLOCK_SIZE)
  }
  if (now - datas.gameOverTime > 1000) {
    drawGameResult();
    for (let i = 0; i < FIELD_ROW; i++) {
      let alpha = 1 - (i * -0.05 + (now - datas.gameOverTime - 1000) / 500);
      CONTEXT.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      CONTEXT.fillRect(0, (FIELD_ROW - i - 1.5) * BLOCK_SIZE, CANVAS_W, BLOCK_SIZE)
    }
  }
  if (now - datas.gameOverTime > 2000) {
    situation = 'RESULT';
  }
}

// リザルト画面描画
function drawGameResult() {
  CONTEXT.clearRect(0, 0, CANVAS.width, CANVAS.height);
  CONTEXT.fillStyle = "#222";
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  drawFillText("GAME", 0, -140, 55, "#222", "bold");
  drawStrokeText("GAME", 0, -140, 55, "#ddd", "bold");
  drawFillText(datas.result, 0, -70, 55, "#222", "bold");
  drawStrokeText(datas.result, 0, -70, 55, "#ddd", "bold");
  drawFillText('-RESULT-', 0, -20, '30', '#ddd', 'normal')
  CONTEXT.fillStyle = '#ddd';
  CONTEXT.font = 'normal 20px "Press Start 2P"';
  CONTEXT.fillText(`LEVEL : ${datas.stats.level}`, 110, 230)
  CONTEXT.fillText(`LINES : ${datas.stats.lines}`, 110, 260)
  CONTEXT.fillText(`SCORE : ${datas.stats.score}`, 110, 290)
  if (checkHighScore()) {
    drawFillText('HiGH SCORE!!', 0, 130, '30', '#ddd', 'normal');
    drawFillText('SHOW LAST SCREEN: Tab', 0, 170, '16', '#ddd', 'normal');
    drawFillText('CONTiNUE: Space', 0, 200, '16', '#ddd', 'normal');
  } else {
    drawFillText('Press SPACE', 0, 160, '16', '#ddd', 'normal');
  }
}

function checkHighScore() {
  if (highScores[datas.mode].hs1.score < datas.stats.score) {
    datas.hsFlag = 'hs1';
    return true;
  } else if (highScores[datas.mode].hs2.score < datas.stats.score) {
    datas.hsFlag = 'hs2';
    return true;
  } else if (highScores[datas.mode].hs3.score < datas.stats.score) {
    datas.hsFlag = 'hs3';
    return true;
  } else if (highScores[datas.mode].hs4.score < datas.stats.score) {
    datas.hsFlag = 'hs4';
    return true;
  } else if (highScores[datas.mode].hs5.score < datas.stats.score) {
    datas.hsFlag = 'hs5';
    return true;
  } else {
    return false;
  }
}

function drawHSPrompt() {
  CONTEXT.clearRect(0, 0, CANVAS.width, CANVAS.height);
  CONTEXT.fillStyle = "#222";
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  drawFillText('HiGH SCORE!!', 0, -150, 35, '#ddd', 'bold');
  drawFillText('Enter your name!', 0, -100, 20, '#ddd', 'bold');
  drawFillText(userName, 0, 0, 40, '#ddd', 'bold');
  drawFillText('ERASE: Back Space', 0, 170, 16, '#ddd', 'bold')
  drawFillText('SUBMiT: Enter / CANCEL: Esc', 0, 200, 16, '#ddd', 'bold');
}

function saveHighScore() {
  let currentHS = highScores[datas.mode];
  let oldHS = JSON.parse(JSON.stringify(highScores[datas.mode]));
  switch (datas.hsFlag) {
    case 'hs1':
      currentHS.hs5 = oldHS.hs4;
      currentHS.hs4 = oldHS.hs3;
      currentHS.hs3 = oldHS.hs2;
      currentHS.hs2 = oldHS.hs1;
      currentHS.hs1 = {
        name: userName,
        level: datas.stats.level,
        lines: datas.stats.lines,
        score: datas.stats.score,
      };
      break;
    case 'hs2':
      currentHS.hs5 = oldHS.hs4;
      currentHS.hs4 = oldHS.hs3;
      currentHS.hs3 = oldHS.hs2;
      currentHS.hs2 = {
        name: userName,
        level: datas.stats.level,
        lines: datas.stats.lines,
        score: datas.stats.score,
      };
      break;
    case 'hs3':
      currentHS.hs5 = oldHS.hs4;
      currentHS.hs4 = oldHS.hs3;
      currentHS.hs3 = {
        name: userName,
        level: datas.stats.level,
        lines: datas.stats.lines,
        score: datas.stats.score,
      };
      break;
    case 'hs4':
      currentHS.hs5 = oldHS.hs4;
      currentHS.hs4 = {
        name: userName,
        level: datas.stats.level,
        lines: datas.stats.lines,
        score: datas.stats.score,
      };
      break;
    case 'hs5':
      currentHS.hs5 = {
        name: userName,
        level: datas.stats.level,
        lines: datas.stats.lines,
        score: datas.stats.score,
      };
      break;
  }
  for (let rank in currentHS) {
    for (let p in currentHS[rank]) {
      setCookie(`${datas.mode}-${rank}-${p}`, currentHS[rank][p])
    }
  }
}

function setCookie(name, value) {
  document.cookie = name + '=' + encodeURIComponent(value) + ';max-age=315360000';
}

// クッキーを連想配列で取得
function getCookies() {
  let result = [];
  if (document.cookie != '') {
    const TMP = document.cookie.split('; ');
    for (let i = 0; i < TMP.length; i++) {
      let data = TMP[i].split('=');
      result[data[0]] = decodeURIComponent(data[1]);
    }
  }
  return result;
}

// クッキーからキーコンフィグ状態を反映
function setByCookie() {
  for (let p in keys) {
    if (allCookies[p] != undefined) {
      keys[p] = allCookies[p];
    }
  }
  for (let mode in highScores) {
    for (let rank in highScores[mode]) {
      if (allCookies[`${mode}-${rank}-name`] != undefined) {
        highScores[mode][rank]['name'] = allCookies[`${mode}-${rank}-name`];
        highScores[mode][rank]['level'] = allCookies[`${mode}-${rank}-level`];
        highScores[mode][rank]['lines'] = allCookies[`${mode}-${rank}-lines`];
        highScores[mode][rank]['score'] = allCookies[`${mode}-${rank}-score`];
      }
    }
  }
}

// ハイスコア画面描画
function drawHighScore () {
  CONTEXT.clearRect(0, 0, CANVAS.width, CANVAS.height);
  CONTEXT.beginPath();
  CONTEXT.fillStyle = "#222";
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  drawFillText("HiGH SCORES", 0, -150, 40, "#ddd", "bold");
  drawFillText(datas.mode.toUpperCase(), 0, -100, 30, "#ddd", "normal");
  let count = 0;
  CONTEXT.font = 'normal 16px "Press Start 2P"'
  CONTEXT.fillText('NAME', 110, 155);
  CONTEXT.fillText('1st', 40, 185);
  CONTEXT.fillText('2nd', 40, 215);
  CONTEXT.fillText('3rd', 40, 245);
  CONTEXT.fillText('4th', 40, 275);
  CONTEXT.fillText('5th', 40, 305);
  if (hsSwitch) {
    CONTEXT.fillText('SCORE', 290, 155);
    for (let rank in highScores[datas.mode]) {
      let t = highScores[datas.mode][rank].score;
      let y = 185 + count * 30;
      let x = 330 - CONTEXT.measureText(t).width / 2;
      CONTEXT.fillText(highScores[datas.mode][rank].name, 118, y);
      CONTEXT.fillText(t, x, y);
      count++;
    }
  } else {
    CONTEXT.fillText('SCORE', 190, 155);
    CONTEXT.fillText('LINES', 290, 155);
    CONTEXT.fillText('LEVEL', 390, 155);
    for (let rank in highScores[datas.mode]) {
      let t = highScores[datas.mode][rank].score;
      if (t > 1000000000) {
        t = '999M+';
      } else if (t > 1000000) {
        t = Math.floor(t / 1000000);
        t += 'M';
      } else if (t > 1000) {
        t = Math.floor(t / 1000);
        t += 'K';
      }
      let y = 185 + count * 30;
      let x = CONTEXT.measureText(t).width / 2;
      CONTEXT.fillText(highScores[datas.mode][rank].name, 118, y);
      CONTEXT.fillText(t, 230 - x, y);
      x = CONTEXT.measureText(highScores[datas.mode][rank].lines).width / 2;
      CONTEXT.fillText(highScores[datas.mode][rank].lines, 330 - x, y);
      x = CONTEXT.measureText(highScores[datas.mode][rank].level).width / 2;
      CONTEXT.fillText(highScores[datas.mode][rank].level, 430 - x, y);
      count++;
    }
  }
  // drawFillText('CHANGE GAME MODE: Space', 0, 140, 16, '#ddd', 'bold');
  drawFillText('CHANGE DiSPLAY: Tab', 0, 170, 16, '#ddd', 'bold');
  drawFillText('BACK TO TiTLE: Esc', 0, 200, 16, '#ddd', 'bold');
}

// キーコンフィグ描画
function drawConfig() {
  CONTEXT.clearRect(0, 0, CANVAS.width, CANVAS.height);
  CONTEXT.beginPath();
  CONTEXT.fillStyle = "#222";
  CONTEXT.fillRect(0, 0, CANVAS.width, CANVAS.height);
  drawFillText("KEY CONFiG", 0, -150, 40, "#ddd", "bold");
  const Y = CANVAS_H / 2 - 100;
  let ny;
  let t;
  let arrow_y;
  for (let p in keys) {
    let key = keys[p];
    switch (key) {
      case "ArrowUp":
        key = "↑";
        break;
      case "ArrowDown":
        key = "↓";
        break;
      case "ArrowLeft":
        key = "<-";
        break;
      case "ArrowRight":
        key = "->";
        break;
      case " ":
        key = "Space";
        break;
    }
    switch (p) {
      case "move_L":
        ny = Y;
        t = `Move Left    : ${key}`;
        break;
      case "move_R":
        ny = Y + 30;
        t = `Move Right   : ${key}`;
        break;
      case "softDrop":
        ny = Y + 60;
        t = `Soft Drop    : ${key}`;
        break;
      case "hardDrop":
        ny = Y + 90;
        t = `Hard Drop    : ${key}`;
        break;
      case "rotate_L":
        ny = Y + 120;
        t = `Rotate Left  : ${key}`;
        break;
      case "rotate_R":
        ny = Y + 150;
        t = `Rotate Right : ${key}`;
        break;
      case "hold":
        ny = Y + 180;
        t = `Hold         : ${key}`;
        break;
    }
    if (datas.selectPos >= 7) {
      arrow_y = datas.selectPos * 30 - 70;
    } else {
      arrow_y = datas.selectPos * 30 - 100;
    }
    if (configPromptMode) {
      key = "_";
      switch (datas.selectPos) {
        case 0:
          oldKey = oldKeys.move_L;
          keys.move_L = key;
          break;
        case 1:
          oldKey = oldKeys.move_R;
          keys.move_R = key;
          break;
        case 2:
          oldKey = oldKeys.softDrop;
          keys.softDrop = key;
          break;
        case 3:
          oldKey = oldKeys.hardDrop;
          keys.hardDrop = key;
          break;
        case 4:
          oldKey = oldKeys.rotate_L;
          keys.rotate_L = key;
          break;
        case 5:
          oldKey = oldKeys.rotate_R;
          keys.rotate_R = key;
          break;
        case 6:
          oldKey = oldKeys.hold;
          keys.hold = key;
          break;
      }
    }
    CONTEXT.font = `normal 18px "Press Start 2P"`;
    CONTEXT.fillStyle = "#ddd";
    CONTEXT.fillText(t, 80, ny);
  }
  CONTEXT.fillText("Default", 80, Y + 270);
  CONTEXT.fillText("Back to Title", 80, Y + 240);
  drawFillText("->", -185, arrow_y, 20, "#ddd", "bold");
  drawFillText("SELECT: Enter / CANCEL: Esc", 0, 210, 14, "#ddd", "normal");
}

// キーコンフィグ変更
function changeKey(key) {
  if (key === "Enter" || key === "Tab") {
    drawConfig();
    drawFillText("CAN'T USE !", 0, 110, 20, "#ddd", "bold");
    return;
  } else if (Object.values(keys).includes(key)) {
    drawConfig();
    drawFillText("ALREADY USED !", 0, 110, 20, "#ddd", "bold");
    return;
  } else if (key === "Escape") {
    key = oldKey;
  }
  switch (datas.selectPos) {
    case 0:
      keys.move_L = key;
      setCookie('move_L', key);
      break;
    case 1:
      keys.move_R = key;
      setCookie('move_R', key);
      break;
    case 2:
      keys.softDrop = key;
      setCookie('softDrop', key);
      break;
    case 3:
      keys.hardDrop = key;
      setCookie('hardDrop', key);
      break;
    case 4:
      keys.rotate_L = key;
      setCookie('rotate_L', key);
      break;
    case 5:
      keys.rotate_R = key;
      setCookie('rotate_R', key);
      break;
    case 6:
      keys.hold = key;
      setCookie('hold', key);
      break;
  }
  configPromptMode = !configPromptMode;
  drawConfig();
}

// コンフィグ確認画面描画
function drawConfirmDiag() {
  let w = 380;
  let h = 110;
  CONTEXT.beginPath();
  CONTEXT.fillStyle = "#222";
  CONTEXT.lineWidth = 1;
  CONTEXT.rect(CANVAS_W / 2 - w / 2, CANVAS_H / 2 - h / 2, w, h);
  CONTEXT.fill();
  CONTEXT.stroke();
  drawFillText(diagText, 0, -25, 20, "#ddd", "bold");
  drawFillText("Are you sure?", 0, 10, 20, "#ddd", "bold");
  drawFillText("yes   no", 0, 40, 20, "#ddd", "bold");
  if (confirmPos === 0) {
    drawFillText("[    ]", -50, 42.5, 20, "#ddd", "bold");
  } else {
    drawFillText("[    ]", 60, 42.5, 20, "#ddd", "bold");
  }
}

// スクショボタン
document.getElementById("download").onclick = (event) => {
  let canvas = document.getElementById("tet_field");

  let link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = "tetris.png";
  link.click();
};

// 確認ボックス
function drawConfirm(key) {
  switch (key) {
    case "ArrowLeft":
      confirmPos--;
      break;
    case "ArrowRight":
      confirmPos++;
      break;
    case "Enter":
      if (confirmPos === 1) {
        confirmPos = 1;
        return 'no';
      } else {
        confirmPos = 1;
        return 'yes';
      }
    case "Escape":
      confirmPos = 1;
      return 'no';
  }
  if (confirmPos < 0) {
    confirmPos += 2;
  }
  confirmPos %= 2;
  drawConfirmDiag();
  return '';
}

// キー押下処理
function keyPush(key) {
  switch (key) {
    case keys.move_L:
      if (!datas.keyStatus.move_L) {
        datas.keyStatus.move_L = true;
        datas.keyStatus.move_L_t = performance.now();
      }
      break;
    case keys.move_R:
      if (!datas.keyStatus.move_R) {
        datas.keyStatus.move_R = true;
        datas.keyStatus.move_R_t = performance.now();
      }
      break;
    case keys.softDrop:
      if (!datas.keyStatus.softDrop) {
        datas.keyStatus.softDrop = true;
        datas.keyStatus.softDrop_t = performance.now();
      }
      break;
  }
}

// キー離上処理
function keyUp(key) {
  switch (key) {
    case keys.move_L:
      datas.keyStatus.move_L = false;
      datas.keyStatus.useDAS = false;
      break;
    case keys.move_R:
      datas.keyStatus.move_R = false;
      datas.keyStatus.useDAS = false;
      break;
    case keys.softDrop:
      datas.keyStatus.softDrop = false;
      break;
  }
}

function keyAction(nowTime) {
  if (!datas.keyStatus.useDAS) {
    if (datas.keyStatus.move_L) {
      if (checkMove(-1, 0)) {
        datas.mino_x--;
        datas.useSpin = false;
        if (!checkMove(0, 1)) {
          if (!datas.onGround) {
            datas.delayTime = performance.now();
          }
          datas.onGround = true;
        } else if (datas.onGround) {
          datas.actionCount++;
          datas.onGround = false;
        }
      }
      datas.keyStatus.useDAS = true;
    }
    if (datas.keyStatus.move_R) {
      if (checkMove(1, 0)) {
        datas.mino_x++;
        datas.useSpin = false;
        if (!checkMove(0, 1)) {
          if (!datas.onGround) {
            datas.delayTime = performance.now();
          }
          datas.onGround = true;
        } else if (datas.onGround) {
          datas.actionCount++;
          datas.onGround = false;
        }
      }
      datas.keyStatus.useDAS = true;
    }
    datas.keyStatus.DAStime = performance.now();
  }
  if (datas.keyStatus.softDrop) {
    let SDFrame = (nowTime - datas.keyStatus.softDrop_t) / 1000 * 60;
    if (SDFrame > ARR_FRAME) {
      if (checkMove(0, 1)) {
        datas.stats.score += 1;
        datas.mino_y++;
        datas.useSpin = false;
        if (!checkMove(0, 1)) {
          if (!datas.onGround) {
            datas.delayTime = performance.now();
          }
          datas.lowestRow = datas.mino_y;
          datas.onGround = true;
        } else if (datas.onGround) {
          if (datas.lowestRow <= datas.mino_y){
            datas.actionCount = 0;
          }
          datas.onGround = false;
        }
      }
    }
  }
  let DASFrame = (nowTime - datas.keyStatus.DAStime) / 1000 * 60;
  if (DASFrame > DAS_FRAME) {
    if (datas.keyStatus.move_L) {
      let MLFrame = (nowTime - datas.keyStatus.move_L_t) / 1000 * 60;
      if (MLFrame - DAS_FRAME > ARR_FRAME) {
        if (checkMove(-1, 0)) {
          datas.mino_x--;
          datas.useSpin = false;
        };
      }
    }
    if (datas.keyStatus.move_R) {
      let MRFrame = (nowTime - datas.keyStatus.move_R_t) / 1000 * 60;
      if (MRFrame - DAS_FRAME > ARR_FRAME) {
        if (checkMove(1, 0)) {
          datas.mino_x++;
          datas.useSpin = false;
        };
      }
    }
  }
}

document.onkeyup = function (e) {
  if (situation === 'GAME') {
    keyUp(e.key);
  }
}

// キーボードイベント
document.onkeydown = function (e) {
  switch (situation) {
    case "GAME": // ノーマルゲーム時
      switch (e.key) {
        case keys.move_L: // 左移動(←)
        case keys.move_R: // 右移動(→)
        case keys.softDrop: // 下移動(↓)
          keyPush(e.key);
          break;
        case keys.hardDrop: // ハードドロップ(↑)
          hardDrop();
          break;
        case keys.rotate_L: // 左回転(a)
          if (minoNum != 6) {
            let rotated = rotateMino(e.key);
            if (rotated) {
              direction -= 1;
              if (direction < 0) {
                direction += 4;
              }
              datas.useSpin = true;
              if (!checkMove(0, 1)) {
                if (datas.onGround) {
                  datas.actionCount++;
                }
                datas.delayTime = performance.now();
                datas.onGround = true;
              } else if (datas.onGround) {
                datas.actionCount++;
                datas.onGround = false;
              }
            }
            if (minoNum === 1) {
              checkTSpin();
            }
          }
          break;
        case keys.rotate_R: // 右回転(d)
          if (minoNum != 6) {
            let rotated = rotateMino(e.key);
            if (rotated) {
              direction = (direction + 1) % 4;
              datas.useSpin = true;
              if (!checkMove(0, 1)) {
                if (datas.onGround) {
                  datas.actionCount++;
                }
                datas.delayTime = performance.now();
                datas.onGround = true;
              } else if (datas.onGround) {
                datas.actionCount++;
                datas.onGround = false;
              }
            }
            if (minoNum === 1) {
              checkTSpin();
            }
            break;
          }
        case keys.hold:
          swapHold();
          break;
        case 'Escape':
          situation = 'PAUSE';
          datas.selectPos = 0;
          datas.keyStatus = new InitialKeyStatus();
          break;
      }
      drawAll();
      break;
    case "PAUSE":
      switch (e.key) {
        case "ArrowUp":
          datas.selectPos--;
          break;
        case "ArrowDown":
          datas.selectPos++;
          break;
        case "Enter":
          switch (datas.selectPos) {
            case 0:
              situation = 'GAME';
              datas.startTime += performance.now() - pauseTime;
              mainLoop();
              return;
            case 1:
              initialize('GAME')
              spawnMino();
              drawAll();
              mainLoop();
              return;
            case 2:
              initialize("TITLE");
              drawTitle();
              return;
          }
          break;
        case "Escape":
          situation = 'GAME';
          datas.startTime += performance.now() - pauseTime;
          mainLoop();
          return;
      }
      if (datas.selectPos < 0) {
        datas.selectPos += 3;
      }
      datas.selectPos %= 3;
      drawAll();
      drawPause();
      break;
    case 'RESULT':
      if (e.key === ' ') {
        if (resultSwitch) {
          if (datas.hsFlag === '') {
            initialize("TITLE");
            drawTitle();
            return;
          } else {
            situation = 'HS_PROMPT';
            drawHSPrompt();
            return;
          }
        }
      } else if (e.key === 'Tab') {
        if (resultSwitch) {
          datas.fixedCol = [];
          drawAll();
        } else {
          drawGameResult();
        }
        resultSwitch = !resultSwitch;
      }
      break;
    case 'HS_PROMPT':
      if (confirmMode === 'none') {
        let canUse = 'abcdefghijklmnopqrstuvwxyz123456789.,-/*+@';
        if (canUse.includes(e.key)) {
          if (userName.replace('_', '').length < 3) {
            userName = userName.replace(/_/g, '');
            userName = userName + e.key.toUpperCase();
            userName = userName.padEnd(3, '_');
          }
        } else {
          switch (e.key) {
            case 'Backspace':
              userName = userName.replace(/_/g, '');
              userName = userName.slice(0, -1);
              userName = userName.padEnd(3, '_');
              break;
            case 'Enter':
              if (!userName.includes('_')) {
                confirmMode = 'name';
                diagText = `Your name is "${userName}"`;
                drawConfirmDiag()
                return;
              } else {
                drawHSPrompt();
                drawFillText('Please enter', 0, 60, 30, '#ddd', 'normal');
                drawFillText('your name!', 0, 100, 30, '#ddd', 'normal');
                return;
              }
            case 'Escape':
              confirmMode = 'esc';
              diagText = `"NOT" submit score`;
              drawConfirmDiag()
              return;
            default:
              drawHSPrompt();
              drawFillText("CAN'T USE !", 0, 80, 30, '#ddd', 'normal');
              return;
          }
        }
        drawHSPrompt();
        break;
      } else {
        drawHSPrompt();
        let react = drawConfirm(e.key);
        if (react === 'yes') {
          if (confirmMode === 'name') {
            saveHighScore();
          } else if (confirmMode === 'esc') {
            // ハイスコアを破棄
          }
          confirmMode = 'none';
          initialize("TITLE");
          drawTitle();
          return;
        } else if (react === 'no') {
          confirmMode = 'none';
          drawHSPrompt();
          return;
        } else {
          return;
        }
      }
    case "TITLE": // タイトル画面時
      switch (e.key) {
        case "ArrowUp":
          datas.selectPos--;
          break;
        case "ArrowDown":
          datas.selectPos++;
          break;
        case "Enter":
          switch (datas.selectPos) {
            case 0:
              initialize("GAME");
              datas.mode = 'normal';
              spawnMino();
              drawAll();
              mainLoop();
              return;
            case 1:
              initialize("HIGH_SCORES")
              datas.mode = 'normal';
              hsSwitch = true;
              drawHighScore();
              return;
            case 2:
              initialize("CONFIG");
              drawConfig();
              return;
          }
          break;
      }
      if (datas.selectPos < 0) {
        datas.selectPos += 3;
      }
      datas.selectPos %= 3;
      drawTitle();
      break;
    case "CONFIG": // コンフィグ時
      if (confirmMode === 'none') {
        if (!configPromptMode) {
          switch (e.key) {
            case "ArrowUp":
              datas.selectPos--;
              break;
            case "ArrowDown":
              datas.selectPos++;
              break;
            case "Enter":
              if (datas.selectPos === 7) {
                confirmMode = 'back';
                diagText = `Back to title`;
                drawConfirmDiag();
                return;
              } else if (datas.selectPos === 8) {
                confirmMode = 'default';
                diagText = `Set default keys`;
                drawConfirmDiag();
                return;
              } else {
                oldKeys = JSON.parse(JSON.stringify(keys));
                configPromptMode = !configPromptMode;
                drawConfig();
              }
              break;
            case "Escape":
              initialize("TITLE");
              drawTitle();
              return;
          }
          if (datas.selectPos < 0) {
            datas.selectPos += 9;
          }
          datas.selectPos %= 9;
          drawConfig();
          break;
        } else {
          changeKey(e.key);
        }
      } else {
        drawConfig();
        let react = drawConfirm(e.key);
        if (react === 'yes') {
          if (confirmMode === 'default') {
            keys = new InitialKeys();
            for (let p in keys) {
              document.cookie = p + '=; max-age=0';
            }
            drawConfig();
          } else if (confirmMode === 'back') {
            initialize("TITLE");
            drawTitle();
          }
          confirmMode = 'none';
          return;
        } else if (react === 'no') {
          confirmMode = 'none';
          drawConfig();
          return;
        } else {
          return;
        }
      }
      break;
    case "HIGH_SCORES":
      switch (e.key) {
        case "Tab":
          hsSwitch = !hsSwitch;
          break;
        case "Escape":
          initialize("TITLE");
          drawTitle();
          return;
      }
      drawHighScore();
    break;
  }
};

// ゲーム本編メインループ
function mainLoop() {
  let nowTime = performance.now();
  let speed = (0.8 - ((datas.stats.level - 1) * 0.007)) ** (datas.stats.level - 1) * 1000;
  let nowFrame = (nowTime - datas.startTime) / speed;
  switch (situation) {
    case "GAME":
      if (nowFrame > datas.frameCount) {
        let c = 0;
        while (nowFrame > datas.frameCount) {
          datas.frameCount++;
          dropMino();
          if (++c >= 4) {
            break;
          }
        }
      }
      keyAction(nowTime);
      if (checkLockDelay()) {
        fixMino();
      }
      drawAll();
      requestAnimationFrame(mainLoop);
      break;
    case "CLEAR_EFFECT":
      let elapsedTime = nowTime - clearTime;
      if (elapsedTime >= 500) {
        for (let line of datas.alignLine) {
          field.splice(line, 1);
          field.unshift(FIELD_TEMPLATE.slice());
          datas.stats.lines++;
        }
        levelUp();
        datas.alignLine = [];
        datas.startTime += elapsedTime;
        situation = "GAME";
      }
      checkGameClear();
      drawAll();
      drawClearEffect();
      requestAnimationFrame(mainLoop);
      break;
    case "GAME_OVER_EFFECT":
      drawGameOverEffect();
      requestAnimationFrame(mainLoop)
      break;
    case "RESULT":
      drawGameResult();
      cancelAnimationFrame(mainLoop);
      break;
    case "PAUSE":
      cancelAnimationFrame(mainLoop);
      pauseTime = performance.now();
      drawPause();
      break;
  }
}

// 画面読み込み時の処理
window.onload = function () {
  datas.startTime = performance.now();
  setByCookie();
  window.addEventListener("keydown", keydownfunc, true);
};

var keydownfunc = function (e) {
  var code = e.keyCode;
  switch (code) {
    case 37: // ←
    case 38: // ↑
    case 39: // →
    case 40: // ↓
    case 32: // Space
    case 9: // Tab
      e.preventDefault();
  }
};

// GoogleFont読み込み完了後の処理
WebFont.load({
  custom: {
    families: ["Press Start 2P"],
  },
  active: function () {
    drawTitle();
  },
  inactive: function () {
    drawTitle();
  },
});