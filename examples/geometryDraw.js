import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { DataManager } from '../managers/DataManager.js';
import { PolygonManager } from '../managers/PolygonManager.js';
import { ChartController } from '../controllers/ChartController.js';

export class GeometryDraw {
  static draw(options) {
    let id, type, x, y, vertices, visible = true, color = null;
    
    if (typeof options === 'object' && options !== null && !Array.isArray(options)) {
      ({ id, type = 'point', x, y, vertices, visible = true, color = null } = options);
    } else {
      x = arguments[0];
      y = arguments[1];
      type = 'point';
      visible = true;
      color = null;
    }

    if (!id) {
      id = STATE.generatePointId();
    }

    if (!color) {
      color = STATE.generateRandomColor();
    }

    if (type === 'polygon') {
      return this.drawPolygon(id, vertices, visible, color);
    } else {
      return this.drawPoint(id, x, y, visible, color);
    }
  }

  static drawPoint(id, x, y, visible, color) {
    STATE.addPoint(id, { type: 'point', x, y, visible, color });

    DataManager.fetchSeries(id, x, y, visible, color);

    const svg = STATE.elements.svg;
    const canvas = STATE.elements.canvas;
    const getCanvasRect = () => canvas.getBoundingClientRect();

    // Always remove existing element first
    svg.select(`circle[data-id="${id}"]`).remove();

    // Only draw if visible
    if (!visible) return id;

    // Only draw if visible
    if (!visible) return id;

    const rect = getCanvasRect();
    const circle = svg.append("circle")
      .attr("data-id", id)
      .attr("cx", x * rect.width)
      .attr("cy", y * rect.height)
      .attr("r", 6)
      .attr("fill", color)
      .attr("stroke", "black")
      .style("pointer-events", "auto")
      .style("cursor", "pointer")
      .call(
        d3.drag()
          .on("start", function() {
            d3.select(this).style("cursor", "pointer");
          })
          .on("drag", function(e) {
            d3.select(this).style("cursor", "pointer");
            d3.select(this)
              .attr("cx", e.x)
              .attr("cy", e.y);
          })
          .on("end", function(e) {
            d3.select(this).style("cursor", "pointer");
            const rect = getCanvasRect();
            const newX = e.x / rect.width;
            const newY = e.y / rect.height;
            STATE.addPoint(id, { type: 'point', x: newX, y: newY, visible, color });
            DataManager.fetchSeries(id, newX, newY, visible, color);
          })
      );

    circle.on("contextmenu", function(e) {
      e.preventDefault();
      e.stopPropagation();
      GeometryDraw.remove(id);
    });

    return id;
  }

  static drawPolygon(id, vertices, visible, color) {
    if (!vertices || vertices.length < 3) {
      console.warn('Polygon requires at least 3 vertices');
      return;
    }

    STATE.addPoint(id, { type: 'polygon', vertices, visible, color });

    PolygonManager.fetchPolygonSeries(id, vertices, visible, color);

    const svg = STATE.elements.svg;
    const wrapper = STATE.elements.wrapperVideo;

    // Always remove existing element first
    svg.select(`g[data-id="${id}"]`).remove();

    // Only draw if visible
    if (!visible) return id;

    this.drawPolygonShape(svg, wrapper, id, vertices, color);

    return id;
  }

  static drawPolygonShape(svg, wrapper, id, vertices, color) {
    const canvas = STATE.elements.canvas;
    const getCanvasRect = () => canvas.getBoundingClientRect();
    const group = svg.append("g")
      .attr("data-id", id)
      .style("pointer-events", "auto");

    let isDraggingPolygon = false;
    let dragStartPos = null;

    const updatePolygon = () => {
      group.selectAll("polygon").remove();
      const rect = getCanvasRect();
      const points = vertices.map(v => 
        `${v.x * rect.width},${v.y * rect.height}`
      ).join(' ');

      group.append("polygon")
        .attr("points", points)
        .attr("fill", color)
        .attr("fill-opacity", 0.2)
        .attr("stroke", color)
        .attr("stroke-width", 2)
        .style("cursor", "move")
        .call(
          d3.drag()
            .on("start", function(e) {
              isDraggingPolygon = true;
              dragStartPos = { x: e.x, y: e.y };
              d3.select(this).style("cursor", "move");
            })
            .on("drag", function(e) {
              if (!isDraggingPolygon) return;
              
              d3.select(this).style("cursor", "move");
              
              const rect = getCanvasRect();
              const dx = (e.x - dragStartPos.x) / rect.width;
              const dy = (e.y - dragStartPos.y) / rect.height;
              
              vertices.forEach(v => {
                v.x += dx;
                v.y += dy;
              });
              
              dragStartPos = { x: e.x, y: e.y };
              
              updatePolygon();
              
              const currentRect = getCanvasRect();
              group.selectAll("circle").each(function(d, i) {
                d3.select(this)
                  .attr("cx", vertices[i].x * currentRect.width)
                  .attr("cy", vertices[i].y * currentRect.height);
              });
            })
            .on("end", function(e) {
              if (isDraggingPolygon) {
                isDraggingPolygon = false;
                dragStartPos = null;
                d3.select(this).style("cursor", "move");
                
                const item = STATE.getPoint(id);
                if (item) {
                  item.vertices = vertices;
                  PolygonManager.fetchPolygonSeries(id, vertices, item.visible, item.color);
                }
              }
            })
        );
    };

    updatePolygon();

    vertices.forEach((vertex, idx) => {
      const rect = getCanvasRect();
      const circle = group.append("circle")
        .attr("cx", vertex.x * rect.width)
        .attr("cy", vertex.y * rect.height)
        .attr("r", 5)
        .attr("fill", color)
        .attr("stroke", "black")
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .call(
          d3.drag()
            .on("start", function(e) {
              d3.select(this).style("cursor", "pointer");
            })
            .on("drag", function(e) {
              d3.select(this).style("cursor", "pointer");
              
              d3.select(this)
                .attr("cx", e.x)
                .attr("cy", e.y);
              
              const rect = getCanvasRect();
              vertices[idx].x = e.x / rect.width;
              vertices[idx].y = e.y / rect.height;
              
              updatePolygon();
            })
            .on("end", function(e) {
              d3.select(this).style("cursor", "pointer");
              
              const item = STATE.getPoint(id);
              if (item) {
                item.vertices = vertices;
                PolygonManager.fetchPolygonSeries(id, vertices, item.visible, item.color);
              }
            })
        );
    });

    group.on("contextmenu", function(e) {
      e.preventDefault();
      e.stopPropagation();
      GeometryDraw.remove(id);
    });
  }

  static remove(id) {
    if (!id) {
      console.warn('GeometryDraw.remove requires an id');
      return;
    }

    const svg = STATE.elements.svg;
    const item = STATE.getPoint(id);
    
    if (item) {
      if (item.type === 'polygon') {
        svg.select(`g[data-id="${id}"]`).remove();
      } else {
        svg.select(`circle[data-id="${id}"]`).remove();
      }
    }
    
    ChartController.removeSeries(id);
    STATE.removePoint(id);
  }

  static removeAll() {
    const svg = STATE.elements.svg;
    
    svg.selectAll("circle").remove();
    svg.selectAll("g[data-id]").remove();
    svg.select('#temp-polygon').remove();
    svg.select('#polygon-preview').remove();
    
    const allPoints = STATE.getAllPoints();
    allPoints.forEach((point, id) => {
      ChartController.removeSeries(id);
    });
    
    STATE.points.clear();
    STATE.cancelPolygon();
  }

  static setMode(mode) {
    if (mode !== 'point' && mode !== 'polygon') {
      console.warn('Invalid mode. Use "point" or "polygon"');
      return;
    }
    STATE.setDrawMode(mode);
    console.log(`Draw mode set to: ${mode}`);
  }

  static getMode() {
    return STATE.getDrawMode();
  }

  static updatePolygonPreview(mouseX, mouseY) {
    const currentPoly = STATE.getCurrentPolygon();
    if (!currentPoly || currentPoly.vertices.length === 0) return;

    const svg = STATE.elements.svg;
    const canvas = STATE.elements.canvas;
    const rect = canvas.getBoundingClientRect();

    // Remove previous preview
    svg.select('#polygon-preview').remove();

    const previewGroup = svg.append('g')
      .attr('id', 'polygon-preview')
      .style('pointer-events', 'none');
    
    const vertices = currentPoly.vertices;

    // Draw lines from each vertex to the next
    for (let i = 0; i < vertices.length - 1; i++) {
      const v1 = vertices[i];
      const v2 = vertices[i + 1];
      
      previewGroup.append('line')
        .attr('x1', v1.x * rect.width)
        .attr('y1', v1.y * rect.height)
        .attr('x2', v2.x * rect.width)
        .attr('y2', v2.y * rect.height)
        .attr('stroke', currentPoly.color)
        .attr('stroke-width', 2)
        .attr('opacity', 0.7);
    }

    // Line from last vertex to cursor (connection preview)
    const lastVertex = vertices[vertices.length - 1];
    
    // Draw a solid background line for better visibility
    // previewGroup.append('line')
    //   .attr('x1', lastVertex.x * rect.width)
    //   .attr('y1', lastVertex.y * rect.height)
    //   .attr('x2', mouseX)
    //   .attr('y2', mouseY)
    //   .attr('stroke', 'white')
    //   .attr('stroke-width', 4)
    //   .attr('opacity', 0.5);
    
    // Draw the main dashed line on top
    previewGroup.append('line')
      .attr('x1', lastVertex.x * rect.width)
      .attr('y1', lastVertex.y * rect.height)
      .attr('x2', mouseX)
      .attr('y2', mouseY)
      .attr('stroke', currentPoly.color)
      .attr('stroke-width', 3)
      .attr('opacity', 0.7);

    // Check distance to first vertex for snap indication
    const firstVertex = vertices[0];
    const distanceToFirst = Math.sqrt(
      Math.pow(mouseX - firstVertex.x * rect.width, 2) + 
      Math.pow(mouseY - firstVertex.y * rect.height, 2)
    );
    const snapThreshold = 15;
    const isNearFirst = vertices.length >= 3 && distanceToFirst < snapThreshold;

    // Draw vertex circles
    vertices.forEach((v, i) => {
      const isFirst = i === 0;
      const shouldHighlight = isFirst && isNearFirst;
      
      previewGroup.append('circle')
        .attr('cx', v.x * rect.width)
        .attr('cy', v.y * rect.height)
        .attr('r', shouldHighlight ? 8 : 4)
        .attr('fill', currentPoly.color)
        .attr('stroke', shouldHighlight ? '#00ff00' : 'black')
        .attr('stroke-width', shouldHighlight ? 3 : 1);
    });

    // Draw cursor point
    previewGroup.append('circle')
      .attr('cx', mouseX)
      .attr('cy', mouseY)
      .attr('r', 4)
      .attr('fill', currentPoly.color)
      .attr('stroke', 'black')
      .attr('stroke-dasharray', '2,2')
      .attr('opacity', 0.7);
  }

  static clearPolygonPreview() {
    const svg = STATE.elements.svg;
    svg.select('#polygon-preview').remove();
  }

  static redrawAll() {
    const svg = STATE.elements.svg;
    const canvas = STATE.elements.canvas;
    const rect = canvas.getBoundingClientRect();

    // Redraw all points and polygons
    STATE.getAllPoints().forEach((item, id) => {
      if (item.type === 'polygon') {
        // Update polygon position
        const group = svg.select(`g[data-id="${id}"]`);
        if (!group.empty()) {
          const polygon = group.select('polygon');
          const pointsStr = item.vertices
            .map(v => `${v.x * rect.width},${v.y * rect.height}`)
            .join(' ');
          polygon.attr('points', pointsStr);

          // Update vertex circles
          group.selectAll('circle').each(function(d, i) {
            const vertex = item.vertices[i];
            d3.select(this)
              .attr('cx', vertex.x * rect.width)
              .attr('cy', vertex.y * rect.height);
          });
        }
      } else {
        // Update point position
        const circle = svg.select(`circle[data-id="${id}"]`);
        if (!circle.empty()) {
          circle
            .attr('cx', item.x * rect.width)
            .attr('cy', item.y * rect.height);
        }
      }
    });
  }

  static toggleVisibility() {
    const svg = STATE.elements.svg;
    const isVisible = svg.style('display') !== 'none';
    
    if (isVisible) {
      svg.style('display', 'none');
    } else {
      svg.style('display', 'block');
    }
    
    return !isVisible;
  }
}
