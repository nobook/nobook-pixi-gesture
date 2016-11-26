/**
 *
 * Created by onlyjyf on 8/10/15.
 */
var NBPoint = require('./NBPoint');
var NBGesture = {
    gesture: {TAP: "gesture.tap", TAP_MISS: "gesture.tapMiss", ZOOM: "gesture.zoom", ROTA: "gesture.rota", PAN: "gesture.pan", HOLD: "hold", CLONE : 'gesture.clone'},

    /**
     * 多点缩放操作
     * 调用该方法后会给target添加一个api
     * activeZoomGesture : 激活多点手势
     * @param container 响应多点的
     * @param target 响应缩放的容器
     * @param conf 配置
     * {
     *      maxZoom:2, minZoom:0.5
     * }
     */
    zoomGesture: function(container, target, conf) {
        // 存储多点对象
        var map = new Map();
        var ticker = PIXI.ticker.shared;
        conf = conf || {};
        if (!target) {
            target = container;
        }
        // 目标对象的位置
        var targetPos = {x:target.x, y:target.y};
        // 目标对象的缩放
        var targetScale = {x:target.scale.x, y:target.scale.y};
        // 缓动速度
        var speed = 0.15;
        // 给container 增加API
        // 增加激活缩放API
        Object.defineProperty(target, 'activeZoomGesture', {
            set : function(value) {
                this.__activeZoomGesture = value;
                if (value === true) {
                    ticker.remove(update);
                    ticker.add(update);
                } else {
                    ticker.remove(update);
                }
            },
            get : function() {
                return this.__activeZoomGesture;
            }
        });

        container.addEventListener(TouchEvent.TOUCH_BEGIN, function(e) {
            if (map.size >= 2) {
                return;
            }
            map.set(e.data.identifier, {x: e.data.global.x, y: e.data.global.y});
            // 激活多点操作
            if (map.size === 2) {
                targetScale.x = target.scale.x;
                targetScale.y = target.scale.y;
                targetPos.x = target.x;
                targetPos.y = target.y;
                target.activeZoomGesture = true;
            }
        }, false, 1);

        // 坐标更新
        function update() {
            target.x += (targetPos.x - target.x) * speed;
            target.y += (targetPos.y - target.y) * speed;

            target.scale.x += (targetScale.x - target.scale.y) * speed;
            target.scale.y += (targetScale.y - target.scale.y) * speed;

            // 发送消息
            target.emit(NBEvent.change.ZOOM, {zoom:target.scale.x});
        }

        container.addEventListener(TouchEvent.TOUCH_MOVE, function(e) {
            // 如果
            if (map.has(e.data.identifier) && map.size === 2) {
                // pA点有移动，pB点还是上一点
                var id = e.data.identifier;
                var pA = map.get(id);
                var pB;
                map.forEach(function(a, index) {
                    if (id != index) {
                        pB = a;
                    }
                });


                // 加上移动坐标的偏移量
                var mdx = (pA.x - e.data.global.x) / 2;
                var mdy = (pA.y - e.data.global.y) / 2;
                targetPos.x -= mdx;
                targetPos.y -= mdy;

                // 上一点和这一点的缩放比率
                var s = NBPoint.distance(e.data.global, pB) / NBPoint.distance(pA, pB);

                var sx = targetScale.x * s;
                if (conf.maxZoom !== undefined) {
                    if (sx > conf.maxZoom) {
                        sx = conf.maxZoom;
                        s = sx / targetScale.x;
                    }
                }

                if (conf.minZoom !== undefined) {
                    if (sx < conf.minZoom) {
                        sx = conf.minZoom;
                        s = sx / targetScale.x;
                    }
                }

                // 以B点为注册点，计算B点和target容器的向量，然后对该向量应用矩阵
                // s-1  0
                // 0    s-1
                // 算出来的结果就是缩放操作过后移动的偏移量，最后在对容器应用矩阵
                // s 0
                // 0 s
                var x = targetPos.x;
                var y = targetPos.y;
                var dsx = pB.x - targetPos.x;
                var dsy = pB.y - targetPos.y;
                dsx *= s - 1;
                dsy *= s - 1;
                x -= dsx;
                y -= dsy;
                // 在赋值给target
                targetPos.x = x;
                targetPos.y = y;

                targetScale.x = sx;
                targetScale.y = sx;

                // 更新坐标
                pA.x = e.data.global.x;
                pA.y = e.data.global.y;

            }
        });

        container.addEventListener(TouchEvent.TOUCH_END, function(e) {
            map.delete(e.data.identifier);
        });

        container.addEventListener(TouchEvent.TOUCH_END_OUDSIDE, function(e) {
            map.delete(e.data.identifier);
        });

        // 返回对象的API
        var o = {};
        o.getTouchCount = function() {
            return map.size;
        }
        return o;
    },

    /**
     * 按压移动事件
     * @param container
     * @param callback
     */
    panGesture: function (container, callback) {
        container.addEventListener(TouchEvent.TOUCH_BEGIN, function (e) {
            container.__panGlobalPos__ = {x: e.data.global.x, y: e.data.global.y};
            var move = function (e) {
                var offsetX = e.data.global.x - container.__panGlobalPos__.x;
                var offsetY = e.data.global.y - container.__panGlobalPos__.y;
                var o = {
                    target: container,
                    data: e.data,
                    offsetX: offsetX,
                    offsetY: offsetY,
                    type: "move",
                    stopPropagation: function () {
                        e.stopPropagation();
                    }
                };
                if (callback) {
                    callback.apply(container, [o]);
                }
                container.emit(NBGesture.gesture.PAN, o);
                container.__panGlobalPos__ = {x: e.data.global.x, y: e.data.global.y};
            }
            var up = function (e) {
                container.removeListener(TouchEvent.TOUCH_MOVE, move);
                container.removeListener(TouchEvent.TOUCH_END_OUDSIDE, up);
                container.removeListener(TouchEvent.TOUCH_END, up);
                var o = {
                    target: container, data: e.data, offsetX: 0, offsetY: 0, type: "end", stopPropagation: function () {
                        e.stopPropagation();
                    }
                };
                if (callback) {
                    callback.apply(container, [o]);
                }
                container.emit(NBGesture.gesture.PAN, o);
            }
            container.addEventListener(TouchEvent.TOUCH_MOVE, move);
            container.addEventListener(TouchEvent.TOUCH_END_OUDSIDE, up);
            container.addEventListener(TouchEvent.TOUCH_END, up);
            var o = {
                target: container, data: e.data, offsetX: 0, offsetY: 0, type: "begin", stopPropagation: function () {
                    e.stopPropagation();
                }
            };
            if (callback) {
                callback.apply(container, [o]);
            }
            container.emit(NBGesture.gesture.PAN, o);
        });
    },
    /**
     *
     * @param container 需要添加手势的容器
     * @param type 手势类型
     * @param callback 回调函数'mouseupoutside'n
     */
    addGesture: function (container, type, callback) {
        switch (type) {
            case this.gesture.TAP:
            {
                this.tapGesture(container, callback);
                break;
            }
            case this.gesture.PAN:
            {
                this.panGesture(container, callback);
                break;
            }
            case this.gesture.HOLD:
            {
                this.holdGesture(container, callback);
            }
        }
    },
    // 按住事件
    holdGesture: function (container, frequent=200) {
        // 按住事件触发时间间隔
        // 在容器中记录触发按住事件的所有触摸点
        container.touches = new Map();
        var events = container.touches;
        var intervalId;
        function begin(event) {
            var o = {target: container, data: event.data, type: "begin", stopPropagation: function () {
                    event.stopPropagation();
                },startPos:{x:event.data.global.x,y:event.data.global.y}};
            if (event.type === "touchstart") {
                events.set(o.data.identifier, o);
            } else {
                events.set("mouse", o);
            }
            container.emit(NBGesture.gesture.HOLD, o);
            intervalId=setInterval(()=>{
                if(events.size===0){
                    clearInterval(intervalId);
                    return;
                }
                o.type="hold";
                events.forEach((v,k)=>{
                    container.emit(NBGesture.gesture.HOLD, v);
                });
            },frequent);

        }

        function move(event) {
            var o = {
                target: container, data: event.data, type: "move", stopPropagation: function () {
                    event.stopPropagation();
                }
            };
            var thatTouch,id;
            if (event.type === "touchmove") {
                id=event.data.identifier;
            } else{
                id="mouse";
            }
            thatTouch = events.get(id);
            if(!thatTouch){
                return;
            }
            let dis = NBPoint.distance(event.data.global, thatTouch.startPos);
            // 若移动距离与最初的触摸点大于40 则在map中移除该点
            if (dis > 40) {
                container.emit(NBGesture.gesture.HOLD,o);
                events.delete(id);
                // 若map为空 则停止计时器
                if(events.size===0){
                    clearInterval(intervalId);
                }
            }
        }
        function end(event){
            var o = {
                target: container, data: event.data, type: "end", stopPropagation: function () {
                    event.stopPropagation();
                }
            };
            var id;
            if(event.type==="touchend"){
                id=event.data.identifier;
            }else{
                id="mouse";
            }
            // 触摸结束事件 根据identifier查找map并移除
            if(events.get(id)){
                container.emit(NBGesture.gesture.HOLD, o);
                events.delete(id);
            }
            // 若map为空 则停止计时器
            if(events.size===0){
                clearInterval(intervalId);
            }

        }
        container.addEventListener(TouchEvent.TOUCH_BEGIN, begin);
        container.addEventListener(TouchEvent.TOUCH_MOVE, move);
        container.addEventListener(TouchEvent.TOUCH_END, end);

    },
    //敲击事件
    tapGesture: function (container, callback) {
        function begin(evt) {
            this.timer = new Date().getTime();
            this.__globalPoint__ = Object.assign({}, evt.data.global);
        }

        function end(evt) {
            var success = false;
            // 点击时间小于200毫秒,并且移动距离小于40px
            if (new Date().getTime() - this.timer < 200) {
                if (NBPoint.distance(this.__globalPoint__, evt.data.global) < 40) {
                    var o = {
                        target: container, data: evt.data, stopPropagation: function () {
                            e.stopPropagation();
                        }
                    };
                    if (callback == null) {
                        container.emit(NBGesture.gesture.TAP, o);
                    } else {
                        callback.apply(container, [o]);
                    }
                    success = true;
                }
            }

            if (success === false) {
                container.emit(NBGesture.gesture.TAP_MISS);
            }
        }

        container.addEventListener(TouchEvent.TOUCH_BEGIN, begin);
        container.addEventListener(TouchEvent.TOUCH_END, end);
        if (container.__gestureMap__ === undefined) {
            container.__gestureMap__ = {};
        }
        if (container.__gestureMap__[this.gesture.TAP] === undefined) {
            container.__gestureMap__[this.gesture.TAP] = [];
        }
        container.__gestureMap__[this.gesture.TAP].push({begin: begin, end: end});
    },

    /**
     * 移除当前对像的手势方法
     * @param container
     * @param type 手势类型
     */
    removeGesture: function (container, type) {
        if (container.__gestureMap__ && container.__gestureMap__[type]) {
            var obj = container.__gestureMap__[type];
            for (var i = 0; i < obj.length; i++) {
                container.removeEventListener(TouchEvent.TOUCH_BEGIN, obj[i].begin);
                container.removeEventListener(TouchEvent.TOUCH_END, obj[i].end);
            }
        }
    },

    /**
     * 克隆器材手势
     * @param container
     * @param conf {
     *      triggerDistance : 100 触发拷贝的距离
     * }
     *
     */
    cloneEqGesture:function(container, conf) {
        conf = conf || {};
        var map = new Map();
        container.addEventListener(TouchEvent.TOUCH_BEGIN, touchBegin);
        // 第一个touch的点
        var firstID = NaN;
        // 第一个点触发的距离
        const FIRST_ID_TIRGGER_DISTANCE = 30;
        var triggerDis = conf.triggerDistance || 100;

        function touchBegin(e) {
            var id = e.data.identifier;
            if (id === undefined) {
                return;
            }
            // 只记录两个touch点
            if (map.size === 2) {
                return;
            }
            if (map.has(id)) {
                return;
            }
            map.set(id, {x:e.data.global.x, y:e.data.global.y});

            if (map.size === 1) {
                container.addEventListener(TouchEvent.TOUCH_MOVE, touchMove);
                container.addEventListener(TouchEvent.TOUCH_END, touchEnd);
                container.addEventListener(TouchEvent.TOUCH_END_OUTSIDE, touchEnd);
            }
        }

        function touchMove(e) {
            if (map.size === 2) {
                var id = e.data.identifier;
                if (id === firstID) {
                    // 如果第一个点移动的距离超过了一定的值就移除当前事件
                    var distance = NBPoint.distance(map.get(id), e.data.global);
                    if (distance > FIRST_ID_TIRGGER_DISTANCE) {
                        map.clear();
                        touchEnd();
                    }
                } else {
                    // 计算第二个点按下的坐标和当前移动之后坐标的距离
                    var distance = NBPoint.distance(map.get(id), e.data.global);
                    if (distance > triggerDis) {
                        container.emit(NBGesture.gesture.CLONE, {global:{x:e.data.global.x, y:e.data.global.y}});
                        map.clear();
                        touchEnd();
                    }
                }
            }
        }

        function touchEnd(e) {
            if (e) {
                var id = e.data.identifier;
                map.delete(id);
            }
            if (map.size === 0) {
                firstID = NaN;
                container.removeListener(TouchEvent.TOUCH_MOVE, touchMove);
                container.removeListener(TouchEvent.TOUCH_END, touchEnd);
                container.removeListener(TouchEvent.TOUCH_END_OUTSIDE, touchEnd);
            }
        }
    }
};

window.NBGesture = NBGesture;
module.exports = NBGesture;
