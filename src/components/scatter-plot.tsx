import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import * as d3 from 'd3';

import styles from './scatter-plot.module.css';

type ScatterPlotProps = {
  data: number[][];
  width?: number;
  height?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  options?: {
    y_label_pos: string;
    x_label: string;
    y_labels: string;
  };
};

export const ScatterPlot = memo(
  ({
    data,
    width = 150,
    height = 150,
    marginTop = 20,
    marginRight = 20,
    marginBottom = 40,
    marginLeft = 40,
    options = {
      y_label_pos: 'side', // alternatives: "side", "top"
      x_label: 'X',
      y_labels: 'Y',
    },
  }: ScatterPlotProps) => {
    // canvas area settings
    const [PLOT_AREA_WIDTH, set_PLOT_AREA_WIDTH] = useState(0);
    const [PLOT_AREA_HEIGHT, set_PLOT_AREA_HEIGHT] = useState(0);
    const [OFFSET_X_AXIS_LABLE, set_OFFSET_X_AXIS_LABLE] = useState(0);
    const [OFFSET_Y_AXIS_LABLE, set_OFFSET_Y_AXIS_LABLE] = useState(0);
    const FONTSIZE_LABLE = 12; //pixel
    const CLEARANCE_Y_AXES = 10; //pixel

    // reference
    const divRef = useRef<HTMLDivElement>(null);
    const gRef = useRef<SVGGElement>(null);
    const xAxis = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
    const tooltip = useRef<d3.Selection<HTMLDivElement, unknown, null, undefined> | null>(null);

    const theme = useTheme();
    const colors = [
      theme.palette.primary.main,
      theme.palette.neutral[500],
      theme.palette.warning.main,
      theme.palette.success.main,
    ];

    /**
     * Calculate canvas dimension
     */
    useEffect(() => {
      set_PLOT_AREA_WIDTH(width - (marginLeft + CLEARANCE_Y_AXES) - marginRight);
      set_PLOT_AREA_HEIGHT(height - marginTop - marginBottom);
      set_OFFSET_X_AXIS_LABLE(marginBottom - FONTSIZE_LABLE);
      // set_OFFSET_Y_AXIS_LABLE(-(marginLeft - FONTSIZE_LABLE));
    }, [width, height, set_PLOT_AREA_WIDTH, set_PLOT_AREA_HEIGHT, set_OFFSET_X_AXIS_LABLE, set_OFFSET_Y_AXIS_LABLE]);

    /**
     * Organize Axes on Canvas
     */
    useEffect(() => {
      // remove tooltip in case it is still there
      d3.select(divRef.current).selectAll(styles.tooltip).remove();

      // create tooltip
      if (!tooltip.current)
        tooltip.current = d3.select(divRef.current).append('div').attr('class', styles.tooltip).style('opacity', 0); // start invisible

      // append plot-area group
      const g = d3.select(gRef.current).attr('transform', `translate(${marginLeft + CLEARANCE_Y_AXES},${marginTop})`);

      // remove all contents
      g.selectAll('*').remove();

      // append initial x, y Scales
      $xScale.domain([0, 100]);

      // append x axis
      xAxis.current = g
        .append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${PLOT_AREA_HEIGHT})`)
        .call($xAxis);

      // add x axis label
      g.append('text')
        .attr('class', 'x-label')
        .attr('font-size', FONTSIZE_LABLE)
        .attr('text-anchor', 'middle')
        .attr('x', PLOT_AREA_WIDTH / 2)
        .attr('y', PLOT_AREA_HEIGHT + OFFSET_X_AXIS_LABLE)
        .text(options.x_label);

      // append y axis
      $appendYAxes(g, PLOT_AREA_HEIGHT);

      // append <path> for lines
      g.append('path').attr('class', $classNameLine(0));

      // add brush
      // if (brushed) g.append("g").attr("class", "brush").call($brush);

      return () => {
        d3.selectAll(styles.tooltip).remove();
      };
    }, [gRef, options, PLOT_AREA_WIDTH, PLOT_AREA_HEIGHT, OFFSET_X_AXIS_LABLE, OFFSET_Y_AXIS_LABLE]);

    /**
     * Draw Lines
     */
    useEffect(() => {
      if (!is2DArray(data)) return;
      if (data[0][0] === undefined) return;

      // remove tooltip to keep canvas clean
      tooltip.current?.style('opacity', 0);

      // update x scale
      $xScale.domain($extent(data, 0));
      xAxis.current?.call($xAxis);

      // update lines and y axes
      let g = d3.select(gRef.current);
      $updateLine(g, data, colors[0]);
    }, [
      gRef.current,
      xAxis.current,
      data,
      PLOT_AREA_WIDTH,
      PLOT_AREA_HEIGHT,
      OFFSET_X_AXIS_LABLE,
      OFFSET_Y_AXIS_LABLE,
    ]);

    // x scale
    const $xScale = d3.scaleLinear().range([0, PLOT_AREA_WIDTH]);

    // y scale
    const $yScale = d3.scaleLinear().range([PLOT_AREA_HEIGHT, 0]);

    // x axis
    const $xAxis = d3.axisBottom($xScale);

    // y axis
    const $yAxis = d3.axisLeft($yScale);

    // append y axes
    const $appendYAxes = (g: d3.Selection<SVGGElement | null, unknown, null, undefined>, plot_area_height: number) => {
      $yScale.domain([0, 100]);
      const color = colors[0];
      let yAxis = g.append('g').attr('class', $classNameYAxis(0)).call($yAxis);
      yAxis.selectAll('path').attr('stroke', color);
      yAxis.selectAll('line').attr('stroke', color);
      yAxis.selectAll('text').attr('fill', color);

      // append y axis label
      let y_label = g
        .append('text')
        .attr('class', $classNameYLabel(0))
        .style('fill', color)
        .attr('font-size', FONTSIZE_LABLE)
        .attr('text-anchor', 'middle');
      if ('y_labels' in options) {
        if (options.y_labels) y_label.text(options.y_labels);
        if (options.y_label_pos === 'side')
          y_label
            .attr('x', -plot_area_height / 2)
            .attr('y', -(marginLeft - FONTSIZE_LABLE))
            .attr('transform', 'rotate(-90)');
        else if (options.y_label_pos === 'top')
          y_label.attr('text-anchor', 'end').attr('x', 0).attr('y', -FONTSIZE_LABLE);
      }
    };

    // line
    const $line = d3
      .line()
      .x((d) => $xScale(d[0]))
      .y((d) => $yScale(d[1]));

    // update line
    const $updateLine = (
      g: d3.Selection<SVGGElement | null, unknown, null, undefined>,
      data: number[][],
      color: string
    ) => {
      // updata y axis
      $yScale.domain($extent(data, 1));
      let yAxis = g.select<SVGGElement>(`.${$classNameYAxis(0)}`);
      yAxis.call($yAxis);
      yAxis.selectAll('path').attr('stroke', color);
      yAxis.selectAll('line').attr('stroke', color);
      yAxis.selectAll('text').attr('fill', color);

      // draw line
      let linePath = g.select(`.${$classNameLine(0)}`);
      linePath
        .attr('d', $line(data as Iterable<[number, number]>))
        .attr('fill', 'none')
        .attr('stroke-width', '2px')
        .attr('stroke', color);

      // append dots
      g.selectAll('dot')
        .data(data)
        .join('circle')
        .attr('cx', (d) => $xScale(d[0]))
        .attr('cy', (d) => $yScale(d[1]))
        .attr('r', 3.5)
        .style('fill', color)
        .on('mouseover', (event, d) => {
          console.log('event', event);
          tooltip.current?.transition().duration(200).style('opacity', 0.7);
          tooltip.current
            ?.html(`x: ${Number(d[0]).toFixed(2)}<br/>y: ${Number(d[1].toFixed(2))}`)
            .style('left', event.pageX + 15 + 'px')
            .style('top', event.pageY - 36 + 'px');
        })
        .on('mouseout', (d) => {
          tooltip.current?.transition().duration(200).style('opacity', 0);
        });
    };

    /* TODO */
    /*
  // brush
  const $brush = d3
    .brushX()
    .extent([
      [0, 0],
      [PLOT_AREA_WIDTH, PLOT_AREA_HEIGHT],
    ])
    .on("start brush end", brushed);
  */

    // tick
    // update

    // find extent
    const $extent = (data: number[][], direction: number) => {
      const extent = d3.extent(data, (d) => d[direction]);
      if (extent[0] !== undefined && extent[1] !== undefined) return extent;
      else return [0, 0];
    };

    // class names
    const $classNameYAxis = (i: number) => `y-axis-${i}`;
    const $classNameYLabel = (i: number) => `y-label-${i}`;
    const $classNameLine = (i: number) => `line-data-${i}`;

    return (
      <div ref={divRef} className="line-chart" style={{ display: 'flex', justifyContent: 'center' }}>
        <svg width={width} height={height}>
          <g ref={gRef}></g>
        </svg>
      </div>
    );
  }
);

// is data an 2D array?
function is2DArray(data: any): data is number[][] {
  return Array.isArray(data[0]) && data.every((row: any) => Array.isArray(row));
}
