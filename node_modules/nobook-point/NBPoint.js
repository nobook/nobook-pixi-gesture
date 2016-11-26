/**
 *
 * Created by onlyjyf on 7/27/15.
 */
var NBPoint = {};
NBPoint.distance = function(p1, p2) {
    var x = p1.x - p2.x;
    var y = p1.y - p2.y;
    return Math.sqrt(x * x + y * y);
}

NBPoint.distanceSquare = function(p1, p2) {
    var x = p1.x - p2.x;
    var y = p1.y - p2.y;
    return x * x + y * y;
}

NBPoint.interpolate = function (pt1, pt2, f)
{
    f = 1 - f;
    var result = {};
    result.x = pt1.x + (pt2.x - pt1.x) * f;
    result.y = pt1.y + (pt2.y - pt1.y) * f;
    return result;
};
global.NBPoint = NBPoint;
module.exports = NBPoint;
