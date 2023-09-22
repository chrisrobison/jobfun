"use strict";

window.addEventListener("load", function() {
    let canv, ctx; // canvas and context
    let maxx, maxy; // canvas dimensions
    let lSegment, nbx, nby, offsx, offsy, posx, posy;
    let segs, nbRot, maxNbRot;
    let grid, started = new Date().getTime();
    let paused = 0, balls, score = 0, mouthCount = 0, mouthDir = 1, dotsEaten = 0, dotsTotal = 0, me;

    const wSegment = 5;

    // for animation
    let messages;

    // shortcuts for Math.
    const mrandom = Math.random;
    const mfloor = Math.floor;
    const mround = Math.round;
    const mceil = Math.ceil;
    const mabs = Math.abs;
    const mmin = Math.min;
    const mmax = Math.max;

    const mPI = Math.PI;
    const mPIS2 = Math.PI / 2;
    const mPIS3 = Math.PI / 3;
    const m2PI = Math.PI * 2;
    const m2PIS3 = (Math.PI * 2) / 3;
    const msin = Math.sin;
    const mcos = Math.cos;
    const matan2 = Math.atan2;

    const mhypot = Math.hypot;
    const msqrt = Math.sqrt;

    const rac3 = msqrt(3);
    const rac3s2 = rac3 / 2;

    //------------------------------------------------------------------------

    function rand(mini, maxi) {
        // random number in given range

        if (typeof maxi == "undefined") return mini * mrandom(); // range 0..mini

        return mini + mrandom() * (maxi - mini); // range mini..maxi
    }
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    function intRand(mini, maxi) {
        // random integer in given range (mini..maxi - 1 or 0..mini - 1)
        //
        if (typeof maxi == "undefined") return mfloor(mini * mrandom()); // range 0..mini - 1
        return mini + mfloor(mrandom() * (maxi - mini)); // range mini .. maxi - 1
    }
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    function arrayShuffle(array) {
        /* randomly changes the order of items in an array
               only the order is modified, not the elements
            */
        let k1, temp;
        for (let k = array.length - 1; k >= 1; --k) {
            k1 = intRand(0, k + 1);
            temp = array[k];
            array[k] = array[k1];
            array[k1] = temp;
        } // for k
        return array;
    } // arrayShuffle
    //------------------------------------------------------------------------
    class EdgeLine {
        constructor(square, side) {
            this.s0 = {
                square,
                side
            };
            this.p0 = {
                x: posx[square.kx + [0, 1, 0, 0][side]],
                y: posy[square.ky + [0, 0, 1, 0][side]]
            };
            this.p1 = {
                x: posx[square.kx + [1, 1, 1, 0][side]],
                y: posy[square.ky + [0, 1, 1, 1][side]]
            };
            //  prevent segments from coming on outer edges of grid
            if (square.ky == 0 && side == 0) this.occupied = true; // top edge
            if (square.kx == nbx - 1 && side == 1) this.occupied = true; // right edge
            if (square.ky == nby - 1 && side == 2) this.occupied = true; // bottom edge
            if (square.kx == 0 && side == 3) this.occupied = true; // left edge
        }
    } // class EdgeLine
    //------------------------------------------------------------------------

    class Segment {
        constructor() {
            let kx, ky, kedge;
            // pick random edge of random square - unouccupied
            do {
                kx = intRand(nbx);
                ky = intRand(nby);
                kedge = intRand(4);
            } while (grid[ky][kx].edges[kedge].edgeLine.occupied);

            this.edgeLine = grid[ky][kx].edges[kedge].edgeLine;
            this.edgeLine.occupied = true;
            this.color = rand(1) > 0.05 ? "white" : `hsl(${intRand(360)} 100% 50%)`;
        } // constructor

        rotate() {
            /* initiates a rotation
                returns true if successful, false if failed (rotation was not possible or already in progress)
                */
            if (this.resting) return false;
            if (this.rotating) return false;

            let poss = [0, 1, 2, 3];
            this.tInit = performance.now();
            this.duration = rand(600, 800);

            otherPoss: while (poss.length) {
                let choice = poss.splice(intRand(poss.length), 1)[0];
                let ssquare = choice & 2 ? this.edgeLine.s0 : this.edgeLine.s1; // choice of the square the segment will cross
                if (ssquare.square.occupied) continue otherPoss; // chosen square already occupied
                let dSide = choice & 1 ? 1 : 3; // choice of rotation (1 means ccw, 3 = -1 % 4 means cw)
                let nextSide = (ssquare.side + dSide) % 4;
                if (ssquare.square.edges[nextSide].edgeLine.occupied)
                    continue otherPoss; // target side already occupied
                // found good move
                ssquare.square.edges[nextSide].edgeLine.occupied = true; // will occupy next side
                let kcenter = (ssquare.side + (choice & 1)) % 4;
                this.center = {
                    x: posx[ssquare.square.kx + [0, 1, 1, 0][kcenter]],
                    y: posy[ssquare.square.ky + [0, 0, 1, 1][kcenter]]
                };
                this.alpha0 = ((kcenter + (choice & 1)) * mPI) / 2; // initial angle
                this.alpha1 = this.alpha0 + ((choice & 1 ? -1 : 1) * mPI) / 2;
                // ssquare.square.occupied = true;
                ssquare.square.gated = true;
                this.sSquare = ssquare;
                this.edgeLine.occupied = false;
                this.edgeLine = ssquare.square.edges[nextSide].edgeLine;
                this.edgeLine.occupied = true;
                this.rotating = true;
                this.tInit = performance.now();
                ++nbRot;
                return true;
            } // while poss.length
            return false; // found no good move
        } // rotate

        draw() {
            ctx.beginPath();
            ctx.lineWidth = wSegment;
            ctx.strokeStyle = this.color;

            if (this.rotating) {
                let dt = performance.now() - this.tInit;
                dt = mmin(1, dt / this.duration);
                let angle = this.alpha0 * (1 - dt) + this.alpha1 * dt;
                ctx.moveTo(this.center.x, this.center.y);
                ctx.lineTo(
                    this.center.x + lSegment * mcos(angle),
                    this.center.y + lSegment * msin(angle)
                );
                if (dt >= 1) {
                    this.rotating = false;
                    this.resting = true;
                    this.duration = rand(800, 1200);
                    this.tInit = performance.now();
                    this.sSquare.square.gated = false;
                    --nbRot;
                }
            } else {
                ctx.moveTo(this.edgeLine.p0.x, this.edgeLine.p0.y);
                ctx.lineTo(this.edgeLine.p1.x, this.edgeLine.p1.y);
                if (this.resting && performance.now() - this.tInit > this.duration) {
                    this.resting = false;
                }
            }
            ctx.stroke();
        } // draw
    } // class Segment

    //------------------------------------------------------------------------
    class Square {
        constructor(kx, ky) {
            // relies on the fact that grid squares are built in a given order
            let otherEdge;

            this.kx = kx;
            this.ky = ky;
            this.dot = 1;
            this.edges = [];
            // top edge
            this.edges[0] = {};
            if (this.ky == 0) {
                this.edges[0].edgeLine = new EdgeLine(this, 0);
            } else {
                otherEdge = grid[ky - 1][kx].edges[2];
                this.edges[0].edgeLine = otherEdge.edgeLine;
                this.edges[0].edgeLine.s1 = {
                    square: this,
                    side: 0
                };
                this.edges[0].other = otherEdge;
                otherEdge.other = this.edges[0];
            }
            // right edge
            this.edges[1] = {};
            this.edges[1].edgeLine = new EdgeLine(this, 1);

            // bottom edge
            this.edges[2] = {};
            this.edges[2].edgeLine = new EdgeLine(this, 2);

            // leftt edge
            this.edges[3] = {};
            if (this.kx == 0) {
                this.edges[3].edgeLine = new EdgeLine(this, 3);
            } else {
                otherEdge = grid[ky][kx - 1].edges[1];
                this.edges[3].edgeLine = otherEdge.edgeLine;
                this.edges[3].edgeLine.s1 = {
                    square: this,
                    side: 3
                };
                this.edges[3].other = otherEdge;
                otherEdge.other = this.edges[3];
            }
            this.draw();
        } // constructor
        
        draw() {
            let x = posx[this.kx] + lSegment / 2;
            let y = posy[this.ky] + lSegment / 2;
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, m2PI);
            ctx.fillStyle = "#fff";
            ctx.fill();
        }
} // class Square
    //------------------------------------------------------------------------
    

    class Ball {
        constructor(radius, isJob=1, isFemale=0) {
            do {
                this.kx = intRand(nbx);
                this.ky = intRand(nby);
            } while (grid[this.ky][this.kx].occupied);
            this.radius = radius;
            this.job = isJob; 
            this.female = isFemale; 
            this.rad1 = this.radius / 2;
            this.dir = intRand(4);
            let hue = intRand(360);

            this.color = `hsl(${hue} 100% 50%)`;
            this.color1 = `hsl(${hue + 180} 100% 50%)`;
            
            this.moveStatus = 0;
            grid[this.ky][this.kx].occupied = true;
            grid[this.ky][this.kx].occupiedBy = this;
            grid[this.ky][this.kx].ball = this;

            if (isJob === false) {
                this.color = "hsl(50 75% 50%)";
                this.color1 = "hsl(230 50% 50%)";
            }

        }

        draw() {
            let x = posx[this.kx] + lSegment / 2;
            let y = posy[this.ky] + lSegment / 2;
            if (this.moveStatus > 0) {
                let alpha = mmin(1, (performance.now() - this.tInit) / this.duration);
                x += this.dx * alpha;
                y += this.dy * alpha;
            }
            
            if (!this.job) {
                ctx.beginPath();
                ctx.arc(x, y, this.radius + 4, 0, m2PI);
                ctx.fillStyle = this.color;
                ctx.fill();
                
                mouthCount += (mouthDir > 0) ? 0.5 : -0.5;

                if ((mouthCount > 6) || (mouthCount < 0)) {
                    mouthDir *= -1;
                }
                
                ctx.beginPath();
                ctx.fillStyle = "#000";
                ctx.arc(x, y + (this.radius / 2) - 4, this.rad1 + 6 - mouthCount, 0, Math.PI);
                ctx.fill();
                //ctx.strokeStyle = "hsl(50 50% 50%)";
                ctx.strokeStyle = this.female ? "#f00" : "#000";
                ctx.lineWidth = 4; // mouthCount;
                ctx.stroke();

            } else {
                ctx.beginPath();
                ctx.textAlign = "left";
                ctx.font = `${this.radius*4}px Apple Color Emoji`;
                ctx.fillText("💰", x - (this.radius*2), y + this.radius);
            }

            // Eyes
            ctx.beginPath();
            ctx.arc(x - this.rad1 + 2, y - 4, (this.rad1 / 2) + 2, 0, m2PI);
            ctx.fillStyle = "#fff";
            ctx.fill();

            ctx.beginPath();
            ctx.arc(x + this.rad1 - 2, y - 4, (this.rad1 / 2) + 2, 0, m2PI);
            ctx.fillStyle = "#fff";
            ctx.fill();

            // Iris 
            ctx.beginPath();
            ctx.arc(x - this.rad1 + 2 + ([0, 1, 0, -1][this.dir]*4), y - 4 + ([-1, 0, 1, 0][this.dir]*3), this.rad1 / 4, 0, m2PI);
            ctx.fillStyle = "#000";
            ctx.fill();

            ctx.beginPath();
            ctx.arc(x + this.rad1 - 2 + ([0, 1, 0, -1][this.dir]*4), y - 4 + ([-1, 0, 1, 0][this.dir]*3), this.rad1 / 4, 0, m2PI);
            ctx.fillStyle = "#000";
            ctx.fill();

            if (!this.job && this.female) {
                // Bow
                let r = this.radius;
                let r1 = this.rad1;
                let yo = -this.radius;
                ctx.beginPath()
                ctx.fillStyle = "#e55cb5";
                ctx.moveTo(x - r1, y - (r1 / 2) - 1 + yo);
                ctx.lineTo(x - (r1 / 4), y - 2 - 1+ yo);
                ctx.lineTo(x + (r1 / 4), y - 2 - 1+ yo);
                ctx.lineTo(x + r1, y - (r1 / 2)- 1 + yo);
                ctx.lineTo(x + r1, y + (r1 / 2) + 1 + yo);
                ctx.lineTo(x + (r1 / 4), y + 2 + 1+ yo);
                ctx.lineTo(x - (r1 / 4), y + 2 + 1+ yo);
                ctx.lineTo(x - r1, y + (r1 / 2) + 1 + yo);
                ctx.lineTo(x - r1, y - (r1 / 2) -  1+ yo);
                ctx.fill();
                
                ctx.moveTo(x - (r1 / 3), y + (r1 / 3) + yo);
                ctx.lineTo(x - (r1 / 3), y - (r1 / 3) + yo);
                ctx.lineTo(x + (r1 / 3), y - (r1 / 3) + yo);
                ctx.lineTo(x + (r1 / 3), y + (r1 / 3) + yo);
                ctx.lineTo(x - (r1 / 3), y + (r1 / 3) + yo);
                ctx.fillStyle = "#ff0000";
                ctx.fill();
                ctx.lineWidth = 3;
                ctx.strokeStyle = "#990000";
                ctx.stroke();
                ctx.closePath();
                
                ctx.beginPath();
                ctx.fillStyle = "#f00";
                ctx.arc(x - (r1 / 2) - 2, y + (r1 * 1.3) + mouthCount, (r1 * .8), (7 * Math.PI) / 6 , (11 * Math.PI) / 6); // Math.PI / 8);
                ctx.fill();
                ctx.closePath();
                
                ctx.beginPath();
                ctx.fillStyle = "#f00";
                ctx.arc(x + (r1 / 2) + 2, y + (r1 * 1.3) + mouthCount, (r1 * .8), (7 * Math.PI) / 6, (11 * Math.PI) / 6 ); // Math.PI / 8);
                ctx.fill();
                ctx.closePath();
/*                
                ctx.beginPath();
                ctx.fillStyle = "#f00";
                ctx.arc(x , y + r1 -mouthCount, r1, (Math.PI) / 12, (11 * Math.PI)/12);
                ctx.lineWidth = 5;
                ctx.strokeStyle = "#f00";
                ctx.stroke();
                ctx.fill();
                ctx.closePath();
*/
            }
        } // draw

        move() {
            switch (this.moveStatus) {
                case 0: // waiting to start move
                    let dirs = arrayShuffle([0, 1, 3]); // changes in direction : forward, turn right, turn left
                    dirs.push(2); // add half turn as a last chance

                    let newDir, nextCell;
                    trydirs: for (let k = 0; k < 4; ++k) {
                        let dir = (this.dir + dirs[k]) % 4;
                        if (grid[this.ky][this.kx].edges[dir].edgeLine.occupied) {
                            continue trydirs; // forbidden edge
                        } 
                        nextCell = grid[this.ky + [-1, 0, 1, 0][dir]][this.kx + [0, 1, 0, -1][dir]];
                        if (this.job && nextCell.occupied) {
                            continue trydirs; // forbidden next cell
                        } else if (!this.job && nextCell.occupied) {
                            addDivConfetti({x: posx[this.kx], y: posy[this.ky]});
                            let idx = balls.indexOf(nextCell.occupiedBy);
                            if ((idx>-1) && balls[idx].job) {
                                balls.splice(idx, 1);
                                nextCell.occupied = false;
                            }
                            score += 50;

                        }

                        newDir = dir;
                        break trydirs;
                    } // for k

                    if (newDir === undefined) return; // can't start move
                    this.tInit = performance.now();
                    this.moveStatus = 1;
                    this.dx = [0, lSegment, 0, -lSegment][newDir];
                    this.dy = [-lSegment, 0, lSegment, 0][newDir];
                    this.dir = newDir;
                    if (!this.job && nextCell.occupied) {
                    }
                    this.nextCell = nextCell;
                    this.nextCell.occupied = true;
                    this.nextCell.occupiedBy = this;
                    if (this.nextCell.dot && !this.job) {
                        this.nextCell.dot = 0;
                        score++;
                        dotsEaten++;

                        if (dotsEaten==dotsTotal) {
                            nextLevel();
                        }
                    }
                    this.duration = intRand(200, 400);
                    break;

                case 1:
                    if (performance.now() >= this.tInit + this.duration) {
                        grid[this.ky][this.kx].occupied = false;
                        this.kx = this.nextCell.kx;
                        this.ky = this.nextCell.ky;
                        this.nextCell.occupied = true;
                        this.moveStatus = 0;
                    }
                    break;
                case 2: 
                    
                    break;
            } // switch
        } // move
    } // class Ball
    //------------------------------------------------------------------------

    class Ball2 {
        constructor(radius, x, y, isJob=1, isFemale=0) {
            this.radius = radius;
            this.job = isJob; 
            this.female = isFemale; 
            this.rad1 = this.radius / 2;
            this.dir = intRand(4);
            let hue = 50;
            this.x = x;
            this.y = y;
            this.color = `hsl(${hue} 50% 50%)`;
            this.color1 = `hsl(${hue + 180} 50% 50%)`;
            
            this.moveStatus = 0;

            if (isJob === false) {
                this.color = "hsl(50 75% 50%)";
                this.color1 = "hsl(230 50% 50%)";
            }

        }

        draw() {
            let x = this.x;
            let y = this.y;

            mouthCount += (mouthDir > 0) ? 0.5 : -0.5;

            if ((mouthCount > 6) || (mouthCount < 0)) {
                mouthDir *= -1;
            }
            if (!this.job) {
                ctx.beginPath();
                ctx.arc(x, y, this.radius + 4, 0, m2PI);
                ctx.fillStyle = this.color;
                ctx.fill();
                
                ctx.beginPath();
                ctx.fillStyle = "#000";
                ctx.arc(x, y + (this.radius / 2) - 4, this.rad1 + 8 - mouthCount, 0, Math.PI);
                ctx.fill();
                //ctx.strokeStyle = "hsl(50 50% 50%)";
                ctx.strokeStyle = this.female ? "#f00" : "#000";
                ctx.lineWidth = 4; // mouthCount;
                ctx.stroke();

            } else {
                ctx.beginPath();
                ctx.textAlign = "left";
                ctx.font = `${this.radius*4}px Apple Color Emoji`;
                ctx.fillText("💰", x - (this.radius*2), y + this.radius);
            }

            // Eyes
            ctx.beginPath();
            ctx.arc(x - this.rad1 + 2, y - 4, (this.rad1 / 2) + 2, 0, m2PI);
            ctx.fillStyle = "#fff";
            ctx.fill();

            ctx.beginPath();
            ctx.arc(x + this.rad1 - 2, y - 4, (this.rad1 / 2) + 2, 0, m2PI);
            ctx.fillStyle = "#fff";
            ctx.fill();

            // Iris 
            ctx.beginPath();
            ctx.arc(x - this.rad1 + 2 + ([0, 1, 0, -1][this.dir]*4), y - 4 + ([-1, 0, 1, 0][this.dir]*3), this.rad1 / 4, 0, m2PI);
            ctx.fillStyle = "#000";
            ctx.fill();

            ctx.beginPath();
            ctx.arc(x + this.rad1 - 2 + ([0, 1, 0, -1][this.dir]*4), y - 4 + ([-1, 0, 1, 0][this.dir]*3), this.rad1 / 4, 0, m2PI);
            ctx.fillStyle = "#000";
            ctx.fill();

            if (!this.job && this.female) {
                // Bow
                let r = this.radius;
                let r1 = this.rad1;
                let yo = -this.radius;
                ctx.beginPath()
                ctx.fillStyle = "#e55cb5";
                ctx.moveTo(x - r1, y - (r1 / 2) - 1 + yo);
                ctx.lineTo(x - (r1 / 4), y - 2 - 1+ yo);
                ctx.lineTo(x + (r1 / 4), y - 2 - 1+ yo);
                ctx.lineTo(x + r1, y - (r1 / 2)- 1 + yo);
                ctx.lineTo(x + r1, y + (r1 / 2) + 1 + yo);
                ctx.lineTo(x + (r1 / 4), y + 2 + 1+ yo);
                ctx.lineTo(x - (r1 / 4), y + 2 + 1+ yo);
                ctx.lineTo(x - r1, y + (r1 / 2) + 1 + yo);
                ctx.lineTo(x - r1, y - (r1 / 2) -  1+ yo);
                ctx.fill();
                
                ctx.moveTo(x - (r1 / 3), y + (r1 / 3) + yo);
                ctx.lineTo(x - (r1 / 3), y - (r1 / 3) + yo);
                ctx.lineTo(x + (r1 / 3), y - (r1 / 3) + yo);
                ctx.lineTo(x + (r1 / 3), y + (r1 / 3) + yo);
                ctx.lineTo(x - (r1 / 3), y + (r1 / 3) + yo);
                ctx.fillStyle = "#ff0000";
                ctx.fill();
                ctx.lineWidth = 3;
                ctx.strokeStyle = "#990000";
                ctx.stroke();
                ctx.closePath();
                
                ctx.beginPath();
                ctx.fillStyle = "#f00";
                ctx.arc(x - (r1 / 2) - 2, y + (r1 * 1.3) + mouthCount, (r1 * .8), (7 * Math.PI) / 6 , (11 * Math.PI) / 6); // Math.PI / 8);
                ctx.fill();
                ctx.closePath();
                
                ctx.beginPath();
                ctx.fillStyle = "#f00";
                ctx.arc(x + (r1 / 2) + 2, y + (r1 * 1.3) + mouthCount, (r1 * .8), (7 * Math.PI) / 6, (11 * Math.PI) / 6 ); // Math.PI / 8);
                ctx.fill();
                ctx.closePath();
/*                
                ctx.beginPath();
                ctx.fillStyle = "#f00";
                ctx.arc(x , y + r1 -mouthCount, r1, (Math.PI) / 12, (11 * Math.PI)/12);
                ctx.lineWidth = 5;
                ctx.strokeStyle = "#f00";
                ctx.stroke();
                ctx.fill();
                ctx.closePath();
*/
            }
        } // draw

    } // class Ball
    //------------------------------------------------------------------------

    let animate;

    {
        // scope for animate

        let animState = 0;

        animate = function(tStamp) {
            let message;

            message = messages.shift();
            if (message && message.message == "reset") animState = 0;
            if (message && message.message == "click") animState = 0;

            if (!paused) {
                window.requestAnimationFrame(animate);

                switch (animState) {
                    case 0:
                        if (startOver()) {
                            ++animState;
                        }
                        break;

                    case 1:
                        ctx.fillStyle = "black";
                        ctx.fillRect(0, 0, maxx, maxy);
                        ctx.beginPath();
                        ctx.lineWidth = wSegment;
                        ctx.rect(posx[0], posy[0], lSegment * nbx, lSegment * nby);
                        ctx.strokeStyle = "white";
                        ctx.stroke();
                        let segy = grid.length;
                        let segx = grid[0].length;

                        grid.forEach((row, ky) => {
                            row.forEach((cell, kx) => {
                                if (cell.dot) {
                                    let x = posx[kx] + lSegment / 2;
                                    let y = posy[ky] + lSegment / 2;
                                    ctx.beginPath();
                                    ctx.arc(x, y, (7 - ~~(segx / 10)), 0, m2PI);
                                    ctx.fillStyle = "#fff";
                                    ctx.fill();
                                }
                            });
                        });

                        segs.forEach((seg) => {
                            if (nbRot < maxNbRot) seg.rotate();
                            seg.draw();
                        }); // segs.forEach
                        balls.forEach((ball) => {
                            ball.move();
                            ball.draw();
                        });
                        ctx.beginPath();
                        ctx.fillStyle = "#0009";
                        ctx.fillRect(0, 5, 350, 100);
                        ctx.lineWidth = 5;
                        ctx.fillStyle = "#fff";
                        ctx.strokeStyle = "#fff";
                        ctx.strokeRect(0, 10, 350, 100);
                        
                        ctx.beginPath();
                        ctx.font = ((window.innerWidth * 0.02) ) + "px Orbitron"
                        ctx.fillStyle = "#0f0";
                        ctx.textAlign = "center";
                        ctx.fillText("SCORE: " + score, 175, 75);

                        ctx.beginPath();
                        ctx.fillStyle = "#0009";
                        ctx.fillRect(window.innerWidth - 450, 5, 450, 100);
                        ctx.lineWidth = 5;
                        ctx.fillStyle = "#fff";
                        ctx.strokeStyle = "#fff";
                        ctx.strokeRect(window.innerWidth - 450, 5, 450, 100);
                        
                        ctx.beginPath();
                        ctx.font = ((window.innerWidth * 0.02) ) + "px \"Michroma\""
                        ctx.fillStyle = "#0f0";
                        ctx.textAlign = "center";

                        let t = ~~(new Date().getTime()/1000);
                        let sec =  t - started;
                        let min = ~~(sec / 60);
                        let hr = ~~(min / 60);
                        sec = sec - (min * 60);
                        min = min - (hr * 60);

                        if (sec < 10) {
                            sec = '0' + sec;
                        }
                        if (min < 10) {
                            min = '0' + min;
                        }
                        if (hr < 10) {
                            hr = '0' + hr;
                        }
                        ctx.fillText(`TIME: ${hr}:${min}:${sec}`, window.innerWidth - 225, (window.innerWidth * 0.03) * 1.5);

                        break;

                    case 2:
                        break;
                } // switch
            }
        }; // animate
    } // scope for animate

    //------------------------------------------------------------------------
    //------------------------------------------------------------------------
    function startOver() {
        // canvas dimensions
        paused = 0;
        score = 0;
        let kx, ky;
        let nbh, nbv;
        let nbSegments;
        started = ~~((new Date().getTime()) / 1000);

        maxx = window.innerWidth;
        maxy = window.innerHeight;

        canv.width = maxx;
        canv.height = maxy;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, maxx, maxy);

        lSegment = msqrt(maxx * maxy) / rand(10, 20);

        nbx = mfloor((maxx - 10) / lSegment);
        nby = mfloor((maxy - 10) / lSegment);
        // adjust lSegment to fill screen as completely as possible
        lSegment = mmin((maxx - 10) / nbx, (maxy - 10) / nby);

        nbx -= 0;
        nby -= 0;

        if (nbx < 2 || nby < 2) return; // pointless

        // positions of line / columns

        offsx = (maxx - nbx * lSegment) / 2;
        offsy = (maxy - nby * lSegment) / 2;
        posx = new Array(nbx + 1).fill(0).map((v, k) => offsx + k * lSegment);
        posy = new Array(nby + 1).fill(0).map((v, k) => offsy + k * lSegment);

        grid = [];
        for (let ky = 0; ky < nby; ++ky) {
            grid[ky] = [];
            for (let kx = 0; kx < nbx; ++kx) {
                grid[ky][kx] = new Square(kx, ky);
            } // for kx
        } // for ky
        
        dotsTotal = ky * kx;

        // total numbers of segments, horizontal and vertical
        nbh = (nby + 1) * nbx;
        nbv = (nbx + 1) * nby;
        nbSegments = mround((nbh + nbv) * rand(0.3, 0.6));
        segs = [];

        for (let k = 0; k < nbSegments; ++k) {
            segs.push(new Segment());
        }
        /*
                    segs.forEach(seg => {
                      ctx.beginPath();
                      ctx.lineWidth = wSegment;
                      ctx.strokeStyle = seg.color
                      let ln = seg.edgeLine;
                      ctx.moveTo(ln.p0.x, ln.p0.y);
                      ctx.lineTo(ln.p1.x, ln.p1.y);
                      ctx.stroke();
                    })
          */
        nbRot = 0;

        maxNbRot = mround(nbSegments * rand(0.05, 0.1));
        
        console.log(`nbSegments: ${nbSegments}`);
        let bagcnt = Math.floor((grid.length / 1) * 1);
        balls = new Array(bagcnt).fill(0).map(() => new Ball(lSegment * 0.3, true));
        
        me = new Ball(lSegment * 0.3, false);
        balls.push(me);

        return true;
    } // startOver

    //------------------------------------------------------------------------

    function mouseClick(event) {
        messages.push({
            message: "click"
        });
    } // mouseClick

    //------------------------------------------------------------------------
    //------------------------------------------------------------------------
    // beginning of execution

    {
        canv = document.createElement("canvas");
        canv.style.position = "absolute";
        document.body.appendChild(canv);
        ctx = canv.getContext("2d");
    } // création CANVAS
    canv.addEventListener("click", mouseClick);
    document.addEventListener("keydown", doKeydown);
    messages = [{
        message: "reset"
    }];

function doKeydown(e) {
    console.log("keydown");
    console.dir(e);

    switch(e.key) {
        case "p":
            if (paused) {
                paused = 0;
                animate();
            } else {
                paused = 1;
            break;

    
       }

    }
}
let ani2stage = 0, animale, anifemale, anibag1, anibag2, heart;
function nextLevel() {
    paused = 1;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, maxx, maxy);
    ctx.beginPath();
    ctx.lineWidth = wSegment;
    ctx.rect(posx[0], posy[0], lSegment * nbx, lSegment * nby);
    ctx.strokeStyle = "white";
    ctx.stroke();
    
    ani2stage = 1;
    done = 0;

    let r = 50;
    animale = new Ball2(50, -r * 8, window.innerHeight * 0.3, 0, 0);
    animale.dx = 6;
    animale.dy = 0;
    animale.dir = 1;

    anifemale = new Ball2(50, window.innerWidth + (r * 8), window.innerHeight * 0.4, 0, 1);
    anifemale.dx = -6;
    anifemale.dy = 0;
    anifemale.dir = 3;

    anibag1 = new Ball2(50, -(r * 2), window.innerHeight * 0.3, 1, 0);
    anibag1.dx = 6.25;
    anibag1.dy = 0;
    anibag1.dir = 1;

    anibag2 = new Ball2(50, (r * 2), window.innerHeight * 0.4, 1, 1);
    anibag2.dx = -6.25;
    anibag2.dy = 0;
    anibag2.dir = 3;

    heart = new Heart(window.innerWidth / 2, window.innerHeight / 2, 100);
    heart.dx = 0;
    heart.dy = -3;

    animate2();
}
window.nextLevel = nextLevel;
window.animate = animate;
window.startOver = startOver;
window.messages = messages;
class Heart {
    constructor(x, y, w=100) {
        this.x = window.innerWidth / 2;
        this.y = window.innerHeight / 2;
        this.w = w;
        this.h = w;
        this.dy = -6;
        this.dx = 0;
    }

    draw() {
        
        var d = Math.min(this.w, this.h);
        var k = this.y;
        ctx.strokeStyle = "#000000";
        ctx.strokeWeight = 3;
        ctx.shadowOffsetX = 4.0;
        ctx.shadowOffsetY = 4.0;
        ctx.lineWidth = 5.0;
        ctx.fillStyle = "#FF0000";
        ctx.moveTo(k, k + d / 4);
        ctx.quadraticCurveTo(k, k, k + d / 4, k);
        ctx.quadraticCurveTo(k + d / 2, k, k + d / 2, k + d / 4);
        ctx.quadraticCurveTo(k + d / 2, k, k + d * 3/4, k);
        ctx.quadraticCurveTo(k + d, k, k + d, k + d / 4);
        ctx.quadraticCurveTo(k + d, k + d / 2, k + d * 3/4, k + d * 3/4);
        ctx.lineTo(k + d / 2, k + d);
        ctx.lineTo(k + d / 4, k + d * 3/4);
        ctx.quadraticCurveTo(k, k + d / 2, k, k + d / 4);
        ctx.stroke();
        ctx.fill();

    }
}
let done = 0;

function animate2() {

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, maxx, maxy);
    ctx.beginPath();
    ctx.lineWidth = wSegment;
    ctx.rect(posx[0], posy[0], lSegment * nbx, lSegment * nby);
    ctx.strokeStyle = "white";
    ctx.stroke();
    
    switch(ani2stage) {
        // Male runs from left to right chasing money
        case 1:    
            animale.x += animale.dx;
            anibag1.x += anibag1.dx;
    
            animale.draw();
            anibag1.draw();

            if (animale.x > window.innerWidth + (animale.radius * 2)) {
                ani2stage = 2;
            }
            break;

        // Female runs from right to left (but lower) chasing money
        case 2:
            anifemale.x += anifemale.dx;
            anibag2.x += anibag2.dx;
    
            anifemale.draw();
            anibag2.draw();

            if (anifemale.x < (anifemale.radius * 2)) {
                anifemale.x = window.innerWidth + ((lSegment * 0.3) * 8);
                anifemale.y = window.innerHeight / 2;
                animale.y = window.innerHeight / 2;
                animale.x = -((lSegment * 0.3) * 8);
                anibag1.x = -((lSegment * 0.3) * 2);
                anibag2.x = window.innerWidth + ((lSegment * 0.3) * 2);
                anibag1.y = window.innerHeight / 2;
                anibag2.y = window.innerHeight / 2;
                ani2stage = 3;
            }
 
            break;

        // Male & Female enter from left & right at same height, chasing money and bump in middle where money explodes
        case 3:
            animale.x += animale.dx;
            anifemale.x += anifemale.dx;
            anibag1.x += anibag1.dx;
            anibag2.x += anibag2.dx;
            anibag1.y += anibag1.dy;
            anibag2.y += anibag2.dy;

            animale.draw();
            anifemale.draw();
            anibag1.draw();
            anibag2.draw();
            
            if (anibag1.x > (window.innerWidth / 2) - (anibag1.radius * 2)) {
                anibag1.dx = 0;
                anibag1.dy = -6;
                anibag2.dx = 0;
                anibag2.dy = -6;
            }
            if (animale.x > (window.innerWidth / 2) - animale.radius) {
                celebrate({x: window.innerWidth / 2, y: window.innerHeight / 2}, 50);
                animale.x = animale.x - animale.radius;
                anifemale.x = anifemale.x + anifemale.radius;
                anibag1.x = -1000;
                anibag2.x = 1000;
                ani2stage = 4;
                heart.dy = -6;
            }
            break;
        case 4:
            animale.draw();
            anifemale.draw();
            
            heart.y += heart.dy;
            heart.draw();

            if (heart.y < 0) {
                done = 1;

                messages.push({
                    message: "reset"
                });
                startOver();
                animate();
            }
            break;
        default:

    }
    if (!done) {
        window.requestAnimationFrame(animate2);
    }
}
    requestAnimationFrame(animate);
}); // window load listener



